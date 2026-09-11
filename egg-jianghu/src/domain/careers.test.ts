import { describe, expect, it } from 'vitest'
import { STARTER_CAREER_ID, careerById, careerJobBookName, careerNameById } from '../content/careers'
import { FACTION_MARTIALS } from '../content/martials'
import { addCareerExperience, careerExperienceForNextLevel, changeCareer } from './careers'
import { createHeroProgress } from './state'

describe('职业修习', () => {
  it('careerNameById 能将所有传承职业 ID 及诸天职业正确解析为全中文', () => {
    expect(careerNameById('inner')).toBe('内家')
    expect(careerNameById('inner_flow_mid')).toBe('运气士')
    expect(careerNameById('inner_flow_high')).toBe('周天师')
    expect(careerNameById('inner_flow_top')).toBe('气宗')
    expect(careerNameById('inner_guard_mid')).toBe('护气士')
    expect(careerNameById('inner_guard_high')).toBe('铁衣护法')
    expect(careerNameById('inner_guard_top')).toBe('金刚宗师')
    expect(careerNameById('sword_swift_mid')).toBe('游剑客')
    expect(careerNameById('job_1')).toBe('白丁')
    expect(careerNameById('job_3')).toBe('武夫')

    // 验证所有势力传承武功的 careerIds 解析后不含任何英文字符
    for (const martial of FACTION_MARTIALS) {
      const chineseNames = martial.careerIds.map((id) => careerNameById(id))
      for (const name of chineseNames) {
        expect(name).toMatch(/^[\u4e00-\u9fa5]+$/)
      }
    }
  })
  it('白丁 1 级升 2 级经验为 114，且职业等级不修改侠客等级', () => {
    expect(careerExperienceForNextLevel(1, 1)).toBe(114)
    const hero = createHeroProgress(STARTER_CAREER_ID)
    addCareerExperience(hero, 114)
    expect(hero.level).toBe(1)
    expect(hero.careers[STARTER_CAREER_ID].level).toBe(2)
    expect(Object.keys(hero.careers)).toEqual([STARTER_CAREER_ID])
  })

  it('白丁各级升级门槛符合原版经验表', () => {
    expect(Array.from({ length: 9 }, (_, index) => careerExperienceForNextLevel(1, index + 1)))
      .toEqual([114, 525, 1359, 2778, 4992, 8266, 12939, 19435, 28286])
  })

  it.each([[2, 1, 4156], [2, 5, 39578], [3, 1, 46706], [6, 10, 174020371]])(
    '职业等阶 %i、等级 %i 的门槛为 %i，包含原版等阶偏移', (rank, level, required) => {
      expect(careerExperienceForNextLevel(rank, level)).toBe(required)
    },
  )

  it.each([1, 10, 20, 44, 100])('侠客升至 %i 级不改变白丁 4→5 的职业门槛', (heroLevel) => {
    const hero = createHeroProgress(STARTER_CAREER_ID)
    const record = hero.careers[STARTER_CAREER_ID]
    record.level = 4
    addCareerExperience(hero, 1000)

    hero.level = heroLevel
    addCareerExperience(hero, 1777)
    expect(record).toEqual({ level: 4, experience: 2777 })
    addCareerExperience(hero, 1)
    expect(record).toEqual({ level: 5, experience: 0 })
    expect(hero.level).toBe(heroLevel)
  })

  it('保留已有职业经验，并按新门槛连续升级后保留余量', () => {
    const hero = createHeroProgress(STARTER_CAREER_ID)
    hero.level = 44
    hero.careers[STARTER_CAREER_ID] = { level: 4, experience: 8000 }
    addCareerExperience(hero, 8)
    expect(hero.careers[STARTER_CAREER_ID]).toEqual({ level: 6, experience: 238 })
    expect(hero.level).toBe(44)
  })

  it('白丁 Lv.5 且持有弓手转职书时可转入弓手', () => {
    const hero = createHeroProgress(STARTER_CAREER_ID)
    hero.careers[STARTER_CAREER_ID].level = 5
    const books = { job_5: 1 }

    expect(changeCareer(hero, 'job_5', books).ok).toBe(true)
    expect(books.job_5).toBe(0)
    expect(hero.currentCareerId).toBe('job_5')
    expect(hero.careers.job_5.level).toBe(1)
    expect(careerJobBookName(careerById('job_5')!)).toBe('弓手转职书')
  })

  it('战斗中不能转职；已修职业可直接切回且不耗书', () => {
    const hero = createHeroProgress(STARTER_CAREER_ID)
    hero.careers[STARTER_CAREER_ID].level = 5
    const books = { job_5: 1 }
    expect(changeCareer(hero, 'job_5', books, true).ok).toBe(false)
    expect(changeCareer(hero, 'job_5', books).ok).toBe(true)
    hero.careers.job_5.level = 7

    expect(changeCareer(hero, STARTER_CAREER_ID, books).ok).toBe(true)
    expect(changeCareer(hero, 'job_5', books).ok).toBe(true)
    expect(hero.careers.job_5.level).toBe(7)
    expect(books.job_5).toBe(0)
  })

  it('五阶主神需要神殿教皇与法皇均达 Lv.10 且持有主神转职书', () => {
    const hero = createHeroProgress(STARTER_CAREER_ID)
    hero.careers.job_28 = { level: 10, experience: 0 }
    hero.careers.job_31 = { level: 9, experience: 0 }
    const books = { job_37: 1 }
    expect(changeCareer(hero, 'job_37', books).ok).toBe(false)
    hero.careers.job_31.level = 10
    expect(changeCareer(hero, 'job_37', books).ok).toBe(true)
    expect(hero.currentCareerId).toBe('job_37')
  })
})
