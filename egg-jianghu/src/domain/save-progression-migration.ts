import { careerById } from '../content/careers'
import { equipmentWearLevel } from '../content/equipment'
import { CAREER_MAX_LEVEL, careerExperienceForNextLevel } from './careers'
import { heroExperienceForNextLevel } from './rewards'
import type { GameStateV10 } from './types'

/** v19 的线性等级按累计经验折算；只由旧版 hydrate 调用一次。 */
export const migrateLegacyProgression = (state: GameStateV10): void => {
  const equipmentByUid = new Map(state.inventory.map(item => [item.uid, item]))
  for (const hero of Object.values(state.heroes)) {
    const total = 50 * hero.level * (hero.level - 1) + hero.experience
    if (!Number.isSafeInteger(hero.level) || hero.level < 1
      || !Number.isSafeInteger(hero.experience) || hero.experience < 0
      || !Number.isSafeInteger(total)) throw new Error('旧档角色经验无法安全换算')
    hero.level = 1
    hero.experience = total
    while (hero.experience >= heroExperienceForNextLevel(hero.level)) {
      hero.experience -= heroExperienceForNextLevel(hero.level)
      hero.level += 1
    }

    // 所有已解锁职业都结算，不改变当前职业和已经满级的记录。
    for (const [id, record] of Object.entries(hero.careers)) {
      const career = careerById(id)
      if (!career) throw new Error(`旧档职业不存在: ${id}`)
      if (!Number.isInteger(record.level) || record.level < 1 || record.level > CAREER_MAX_LEVEL
        || !Number.isSafeInteger(record.experience) || record.experience < 0) throw new Error('旧档职业经验无效')
      while (record.level < CAREER_MAX_LEVEL) {
        const required = careerExperienceForNextLevel(career.rank, record.level)
        if (record.experience < required) break
        record.experience -= required
        record.level += 1
        if (record.level === CAREER_MAX_LEVEL) record.experience = 0
      }
    }

    // inventory 已包含穿戴实例。清除全部方案的引用即可回包，满包也不丢物品。
    for (const loadout of hero.equipmentSets) {
      for (const [slot, uid] of Object.entries(loadout)) {
        const item = uid ? equipmentByUid.get(uid) : undefined
        if (item && hero.level < (item.equipmentLevel ?? equipmentWearLevel(item.level, item.quality))) {
          loadout[slot] = null
        }
      }
    }
  }
}
