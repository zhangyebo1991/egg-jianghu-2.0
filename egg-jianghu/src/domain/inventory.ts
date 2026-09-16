import type { ActionResult, EquipmentInstance, EquipmentQuality, GameStateV10, HeroProgressV10 } from './types'
import {
  EQUIPMENT_SET_COUNT,
  EQUIPMENT_SLOTS,
  canonicalEquipmentDefinitionId,
  canonicalEquipmentSlot,
  equipmentDefinitionById,
  equipmentDisplayName,
  equipmentWearLevel,
  isEquipmentSetIndex,
  type EquipmentSetIndex,
} from '../content/equipment'
import { martialIdFromOriginal } from '../content/martials'
import { grantPermanentMartial } from './martial-training'
import { ATTRIBUTE_BY_ID } from '../content/attributes'
import { equipmentAttributeValue } from '../content/equipment'

export type EquipmentBuild = 'physical' | 'magical'

// 以一级、标准系数的装备属性归一化，避免生命的绝对数值压过攻击等词条。
const equipmentScore = (item: EquipmentInstance, build: EquipmentBuild, core: boolean): number => {
  const ignored = build === 'physical' ? [10, 22] : [8, 20]
  return (core ? item.coreStats : item.affixes).reduce((sum, stat) => {
    const attribute = ATTRIBUTE_BY_ID[stat.attributeId]
    if (!attribute?.combatFlag || ignored.includes(stat.attributeId)) return sum
    return sum + equipmentAttributeValue(stat.attributeId, item.level, stat.coefficient, core ? 100 : 50)
      / equipmentAttributeValue(stat.attributeId, 1, 100, 100)
  }, 0)
}

export const equipBestEquipment = (state: GameStateV10, heroId: string, build: EquipmentBuild): ActionResult => {
  const hero = state.heroes[heroId]
  if (!hero?.recruited) return { ok: false, message: '侠客尚未加入' }
  const loadout = bindActiveEquipmentLoadout(hero)
  // 备用方案也占用装备；自动穿戴不挪用它们，避免破坏已经搭配好的方案。
  const available = state.inventory.filter((item) => equipmentOwnerId(state, item.uid) === null
    || Object.values(loadout).includes(item.uid))
  const matchesBuild = (item: EquipmentInstance): boolean => {
    const desired = build === 'physical' ? [8, 20] : [10, 22]
    const opposite = build === 'physical' ? [10, 22] : [8, 20]
    return item.coreStats.some((stat) => desired.includes(stat.attributeId))
      || !item.coreStats.some((stat) => opposite.includes(stat.attributeId))
  }
  let changed = 0
  for (const slot of EQUIPMENT_SLOTS) {
    // 至宝包含永久授予武学等特殊效果，不能按数值自动判断优劣。
    if (slot === 'treasure') continue
    const current = state.inventory.find((item) => item.uid === loadout[slot])
    let best = current
    for (const item of available) {
      const definition = equipmentDefinitionById(canonicalEquipmentDefinitionId(item.definitionId))
      if (definition?.slot !== slot || !matchesBuild(item) || hero.level < (item.equipmentLevel ?? equipmentWearLevel(item.level, item.quality))) continue
      const core = equipmentScore(item, build, true)
      // 只有另一流派攻击的装备不填入空槽；通用生命、防御、速度正常参与。
      if (core <= 0) continue
      const bestCore = best && matchesBuild(best) ? equipmentScore(best, build, true) : -1
      if (core > bestCore || (core === bestCore && best && equipmentScore(item, build, false) > equipmentScore(best, build, false))) best = item
    }
    if (best && best.uid !== current?.uid) {
      const result = equipEquipment(state, heroId, best.uid)
      if (!result.ok) return result
      changed += 1
    }
  }
  const label = build === 'physical' ? '物理' : '法术'
  return { ok: true, message: changed ? `已按${label}方向穿戴 ${changed} 件装备` : `当前已是可用装备中的${label}最优搭配` }
}

export const INVENTORY_CAPACITY = 300

export type AddEquipmentResult = { ok: true } | { ok: false; reason: 'inventory-full' }

const remapLoadoutInPlace = (raw: Record<string, string | null>): Record<string, string | null> => {
  for (const [slot, uid] of Object.entries(raw)) {
    const canonical = canonicalEquipmentSlot(slot)
    if (!canonical) {
      delete raw[slot]
      continue
    }
    if (canonical !== slot) {
      if (raw[canonical] == null) raw[canonical] = uid
      delete raw[slot]
    }
  }
  return raw
}

export const normalizeHeroEquipment = (hero: HeroProgressV10): void => {
  const sourceSets = Array.isArray(hero.equipmentSets) && hero.equipmentSets.length > 0
    ? [...hero.equipmentSets]
    : [hero.equipmentBySlot ?? {}]
  while (sourceSets.length < EQUIPMENT_SET_COUNT) sourceSets.push({})
  const equipmentSets = [0, 1, 2].map((index) => remapLoadoutInPlace(sourceSets[index] ?? {})) as HeroProgressV10['equipmentSets']
  const requestedIndex = hero.activeEquipmentSetIndex
  const activeEquipmentSetIndex: EquipmentSetIndex = isEquipmentSetIndex(requestedIndex) ? requestedIndex : 0
  hero.equipmentSets = equipmentSets
  hero.activeEquipmentSetIndex = activeEquipmentSetIndex
  hero.equipmentBySlot = equipmentSets[activeEquipmentSetIndex]
}

export const normalizeInventoryInstances = (inventory: EquipmentInstance[]): void => {
  for (const item of inventory) {
    item.definitionId = canonicalEquipmentDefinitionId(item.definitionId)
    item.equipmentLevel ??= equipmentWearLevel(item.level, item.quality)
  }
}

export const bindActiveEquipmentLoadout = (hero: HeroProgressV10): Record<string, string | null> => {
  normalizeHeroEquipment(hero)
  return hero.equipmentBySlot
}

const heroLoadouts = (hero: HeroProgressV10): Array<Record<string, string | null>> => {
  normalizeHeroEquipment(hero)
  return hero.equipmentSets
}

const releaseEquipmentFromHero = (hero: HeroProgressV10, uid: string): void => {
  for (const loadout of heroLoadouts(hero)) {
    for (const [slot, equippedUid] of Object.entries(loadout)) {
      if (equippedUid === uid) loadout[slot] = null
    }
  }
}

// inventory 保存全部装备实例；物品栏仅包含尚未被侠客穿戴的装备。
export const backpackEquipment = (state: GameStateV10): EquipmentInstance[] =>
  state.inventory.filter((item) => equipmentOwnerId(state, item.uid) === null)

export const addEquipment = (
  state: GameStateV10,
  equipment: EquipmentInstance,
): AddEquipmentResult => {
  if (backpackEquipment(state).length >= INVENTORY_CAPACITY) {
    state.statistics.equipmentMissedAtCapacity += 1
    return { ok: false, reason: 'inventory-full' }
  }
  if (state.inventory.some((item) => item.uid === equipment.uid) || state.city.shop.stock.some(item => item.uid === equipment.uid)) {
    throw new Error(`重复装备 uid: ${equipment.uid}`)
  }
  state.inventory.push(equipment)
  return { ok: true }
}

export const equipEquipment = (
  state: GameStateV10,
  heroId: string,
  equipmentUid: string,
): ActionResult => {
  const hero = state.heroes[heroId]
  const equipment = state.inventory.find((item) => item.uid === equipmentUid)
  if (!hero?.recruited) return { ok: false, message: '侠客尚未加入' }
  if (!equipment) return { ok: false, message: '装备不存在' }
  const definition = equipmentDefinitionById(canonicalEquipmentDefinitionId(equipment.definitionId))
  if (!definition) return { ok: false, message: '装备部位定义不存在' }
  const equipmentLevel = equipment.equipmentLevel ?? equipmentWearLevel(equipment.level, equipment.quality)
  if (hero.level < equipmentLevel) return { ok: false, message: `人物等级不足，需达到穿戴等级 Lv.${equipmentLevel}` }
  const ownerId = equipmentOwnerId(state, equipmentUid)
  if (ownerId && ownerId !== heroId) return { ok: false, message: '装备已被其他侠客穿戴' }
  const loadout = bindActiveEquipmentLoadout(hero)
  if (loadout[definition.slot] === equipmentUid) return { ok: false, message: '装备已经穿戴' }

  if (definition.equipmentKind === 'treasure-manual' && definition.grantSkillId) {
    const sourceItemId = String(definition.sourceItemId ?? definition.id)
    if (!state.treasureManualGrants[sourceItemId]) {
      const grant = grantPermanentMartial(state, heroId, martialIdFromOriginal(definition.grantSkillId))
      if (!grant.ok) return grant
      state.treasureManualGrants[sourceItemId] = heroId
    }
  }

  releaseEquipmentFromHero(hero, equipmentUid)
  loadout[definition.slot] = equipmentUid
  return { ok: true, message: '装备成功' }
}

export const unequipEquipment = (
  state: GameStateV10,
  heroId: string,
  slot: string,
): ActionResult => {
  const hero = state.heroes[heroId]
  if (!hero?.recruited) return { ok: false, message: '侠客尚未加入' }
  const canonicalSlot = canonicalEquipmentSlot(slot)
  const loadout = bindActiveEquipmentLoadout(hero)
  if (!canonicalSlot || !loadout[canonicalSlot]) return { ok: false, message: '该部位没有装备' }
  if (backpackEquipment(state).length >= INVENTORY_CAPACITY) {
    return { ok: false, message: '物品栏已满，无法卸下装备' }
  }
  loadout[canonicalSlot] = null
  return { ok: true, message: '已卸下装备' }
}

export const switchEquipmentSet = (
  state: GameStateV10,
  heroId: string,
  setIndex: number,
): ActionResult => {
  const hero = state.heroes[heroId]
  if (!hero?.recruited) return { ok: false, message: '侠客尚未加入' }
  if (!isEquipmentSetIndex(setIndex)) return { ok: false, message: '装备方案不存在' }
  bindActiveEquipmentLoadout(hero)
  hero.activeEquipmentSetIndex = setIndex
  hero.equipmentBySlot = hero.equipmentSets[setIndex]
  return { ok: true, message: `已切换至第${setIndex + 1}套装备` }
}

export const toggleEquipmentLock = (state: GameStateV10, equipmentUid: string): ActionResult => {
  const equipment = state.inventory.find((item) => item.uid === equipmentUid)
  if (!equipment) return { ok: false, message: '装备不存在' }
  equipment.locked = !equipment.locked
  return { ok: true, message: equipment.locked ? '装备已锁定' : '装备已解锁' }
}

export const discardEquipment = (state: GameStateV10, equipmentUid: string): ActionResult => {
  const equipment = state.inventory.find((item) => item.uid === equipmentUid)
  if (!equipment) return { ok: false, message: '装备不存在' }
  if (equipment.locked) return { ok: false, message: '此物已上锁，先解锁再丢弃' }
  if (isEquipmentEquipped(state, equipmentUid)) return { ok: false, message: '已穿戴装备请先到侠客页卸下' }

  state.inventory = state.inventory.filter((item) => item.uid !== equipmentUid)
  const definition = equipmentDefinitionById(canonicalEquipmentDefinitionId(equipment.definitionId))
  const name = definition ? equipmentDisplayName(definition, equipment.affixes) : '装备'
  return { ok: true, message: `已丢弃 ${name}` }
}

export const organizeInventory = (state: GameStateV10): ActionResult => {
  state.inventory.sort((left, right) => {
    const leftDefinition = equipmentDefinitionById(canonicalEquipmentDefinitionId(left.definitionId))
    const rightDefinition = equipmentDefinitionById(canonicalEquipmentDefinitionId(right.definitionId))
    const slotDifference = EQUIPMENT_SLOTS.indexOf(leftDefinition?.slot ?? 'ring')
      - EQUIPMENT_SLOTS.indexOf(rightDefinition?.slot ?? 'ring')
    if (slotDifference !== 0) return slotDifference
    const qualityDifference = right.quality - left.quality
    if (qualityDifference !== 0) return qualityDifference
    if (left.level !== right.level) return right.level - left.level
    const definitionDifference = left.definitionId.localeCompare(right.definitionId)
    return definitionDifference || left.uid.localeCompare(right.uid)
  })
  return { ok: true, message: '物品已按部位、品质和等级整理' }
}

// 返回穿戴该装备的侠客 id，未穿戴则 null（任意一套占用即视为穿戴）
export const equipmentOwnerId = (state: GameStateV10, uid: string): string | null => {
  for (const [heroId, progress] of Object.entries(state.heroes)) {
    for (const loadout of heroLoadouts(progress)) {
      if (Object.values(loadout).includes(uid)) return heroId
    }
  }
  return null
}

// 判断装备是否正被某位侠客穿戴
const isEquipmentEquipped = (state: GameStateV10, uid: string): boolean =>
  equipmentOwnerId(state, uid) !== null

// 原版「物品买卖价格function」：买价 max(round((修正系数×10)×(10+物品等级)×2.5^品质), 1)，售价为买价 × 0.4。
// 装备的修正系数按 1 处理。
export const equipmentSellPrice = (equipment: EquipmentInstance): number =>
  Math.max(Math.round((10 + equipment.level) * Math.pow(2.5, equipment.quality) * 10 * 0.4), 1)

export const sellEquipmentByQuality = (
  state: GameStateV10,
  maxQuality: EquipmentQuality,
  worldId: string,
): ActionResult => {
  const sold = state.inventory.filter((item) =>
    item.quality <= maxQuality
    && !item.locked
    && !isEquipmentEquipped(state, item.uid))
  if (sold.length === 0) return { ok: false, message: '没有可售出的装备' }
  const removed = new Set(sold.map((item) => item.uid))
  state.inventory = state.inventory.filter((item) => !removed.has(item.uid))
  const income = sold.reduce((total, item) => total + equipmentSellPrice(item), 0)
  state.worldCurrency[worldId] = (state.worldCurrency[worldId] ?? 0) + income
  return { ok: true, message: `已售出 ${sold.length} 件装备，获得铜钱 ${income}` }
}

export const averageItemLevel = (hero: HeroProgressV10, inventory: EquipmentInstance[]): number => {
  const loadout = bindActiveEquipmentLoadout(hero)
  const total = EQUIPMENT_SLOTS.reduce((sum, slot) => {
    const uid = loadout[slot]
    const item = uid ? inventory.find((candidate) => candidate.uid === uid) : undefined
    return sum + (item?.level ?? 0)
  }, 0)
  return Math.floor(total / EQUIPMENT_SLOTS.length)
}
