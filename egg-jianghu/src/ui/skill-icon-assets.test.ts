import { describe, expect, it } from 'vitest'
import { COMBAT_SKILLS } from '../content/skills'
import { MARTIALS_V10 } from '../content/martials'
import { martialIconAsset } from './career-icon-assets'
import { skillIconAsset } from './skill-icon-assets'
import evidenceText from '../../../docs/evidence/original-world/skill-icons-assets.json?raw'

const evidence = JSON.parse(evidenceText) as {
  entries: Array<{ id: number; iconKey: string; fallback: boolean; sha256: string }>
}
const assets = import.meta.glob<string>('../assets/skills/original/skill_*.webp', { eager: true, import: 'default' })

describe('原版技能图标', () => {
  it('376技能全部有对应文件，只有原表无图标的38项使用攻击图标', () => {
    expect(Object.keys(COMBAT_SKILLS)).toHaveLength(376)
    expect(evidence.entries).toHaveLength(376)
    expect(evidence.entries.filter(entry => entry.fallback)).toHaveLength(38)
    const attack = evidence.entries.find(entry => entry.id === 1)!
    for (const skill of Object.values(COMBAT_SKILLS)) {
      const entry = evidence.entries.find(entry => entry.id === skill.id)!
      expect(entry, skill.name).toBeDefined()
      expect(assets[`../assets/skills/original/skill_${skill.id}.webp`], skill.name).toBeTruthy()
      expect(skillIconAsset(skill.id)).toBe(assets[`../assets/skills/original/skill_${skill.id}.webp`])
      if (entry.fallback) {
        expect(entry.iconKey).toBe('0')
        expect(entry.sha256).toBe(attack.sha256)
      }
    }
  })
  it('所有可学武学按原版技能ID取图，同类技能不再共用类别图', () => {
    for (const martial of MARTIALS_V10) expect(martialIconAsset(martial.id)).toBe(skillIconAsset(martial.originalSkillId))
    const entries = [42, 43, 44].map(id => evidence.entries.find(entry => entry.id === id)!)
    expect(new Set(entries.map(entry => entry.sha256)).size).toBe(3)
    expect(skillIconAsset(-1)).toBe(skillIconAsset(1))
    expect(martialIconAsset('missing')).toBe(skillIconAsset(1))
    expect(skillIconAsset(0)).not.toBe(skillIconAsset(1))
  })
})
