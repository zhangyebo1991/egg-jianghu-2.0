import { describe, expect, it } from 'vitest'
import { STARTER_CAREER_ID, careerById, careerJobBookName } from '../content/careers'
import { addCareerExperience, careerExperienceForNextLevel, changeCareer } from './careers'
import { createHeroProgress } from './state'

describe('职业修习', () => {
  it('白丁 1 级升 2 级经验为 114，且职业等级不修改侠客等级', () => {
    expect(careerExperienceForNextLevel(1, 1, 1)).toBe(114)
    const hero = createHeroProgress(STARTER_CAREER_ID)
    addCareerExperience(hero, 114)
    expect(hero.level).toBe(1)
    expect(hero.careers[STARTER_CAREER_ID].level).toBe(2)
    expect(Object.keys(hero.careers)).toEqual([STARTER_CAREER_ID])
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
