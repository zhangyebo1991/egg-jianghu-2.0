import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const zy = JSON.parse(fs.readFileSync(
  'D:/Projects/OpenProject/花旦的各种小游戏/挂机游戏/诸天刷宝录/_analysis/zy.json',
  'utf8',
))

const cell = (x, y) => {
  const value = zy.data[x][y]
  return Array.isArray(value) ? value[0] : value
}

const TIERS = {
  1: '初级',
  2: '一阶',
  3: '二阶',
  4: '三阶',
  5: '四阶',
  6: '五阶',
}

// zy 列 12..17 是六类职业基础系数，18..23 是对应的每级成长值。
// 属性编码 1..6 依次用于：物攻、物防、法攻、法防、核心面板、治疗。
const GROWTH_KEYS = [
  'physicalAttack',
  'physicalDefense',
  'magicAttack',
  'magicDefense',
  'core',
  'heal',
]

const lines = []
for (let x = 1; x <= 41; x += 1) {
  const rank = Number(cell(x, 3))
  const name = String(cell(x, 1)).trim()
  const description = String(cell(x, 5) ?? '').trim()
  const skillTypeIds = rank === 6
    ? [Number(cell(x, 24)), Number(cell(x, 25))]
    : [Number(cell(x, 24))]
  const requirements = []
  if (rank >= 2 && rank <= 5) {
    requirements.push({ careerId: `job_${Number(cell(x, 28))}`, level: Number(cell(x, 29)) })
  } else if (rank === 6) {
    requirements.push({ careerId: `job_${Number(cell(x, 28))}`, level: Number(cell(x, 29)) })
    requirements.push({ careerId: `job_${Number(cell(x, 30))}`, level: Number(cell(x, 31)) })
  }
  const growth = Object.fromEntries(GROWTH_KEYS.map((key, index) => [
    key,
    Number(String(cell(x, 12 + index)).trim()) / 100,
  ]))
  const levelGrowth = Object.fromEntries(GROWTH_KEYS.map((key, index) => [
    key,
    Number(String(cell(x, 18 + index)).trim()) / 1000,
  ]))
  lines.push(`  {
    id: 'job_${x}',
    zyId: ${x},
    name: ${JSON.stringify(name)},
    description: ${JSON.stringify(description)},
    tier: '${TIERS[rank]}',
    rank: ${rank},
    skillTypeIds: [${skillTypeIds.join(', ')}],
    growth: {
      physicalAttack: ${growth.physicalAttack},
      physicalDefense: ${growth.physicalDefense},
      magicAttack: ${growth.magicAttack},
      magicDefense: ${growth.magicDefense},
      core: ${growth.core},
      heal: ${growth.heal},
    },
    levelGrowth: {
      physicalAttack: ${levelGrowth.physicalAttack},
      physicalDefense: ${levelGrowth.physicalDefense},
      magicAttack: ${levelGrowth.magicAttack},
      magicDefense: ${levelGrowth.magicDefense},
      core: ${levelGrowth.core},
      heal: ${levelGrowth.heal},
    },
    requirements: [${requirements.map((item) => `{ careerId: '${item.careerId}', level: ${item.level} }`).join(', ')}],
    basicAttackSkillId: ${Number(cell(x, 6))},
  }`)
}

const out = `export type CareerCategory = '剑' | '刀' | '拳' | '暗' | '医' | '内家'
export type CareerTier = '初级' | '一阶' | '二阶' | '三阶' | '四阶' | '五阶'

export const SKILL_TYPE_NAMES: Record<number, string> = {
  1: '通用',
  2: '战技',
  3: '武功',
  4: '符咒',
  5: '箭弩',
  6: '方术',
  7: '异能',
  8: '神技',
  9: '斗气',
  10: '忍术',
  11: '魔法',
  12: '功法',
  13: '枪械',
  14: '机甲',
  15: '召唤',
  16: '医术',
}

export interface CareerRequirement {
  careerId: string
  level: number
}

export interface CareerGrowth {
  physicalAttack: number
  physicalDefense: number
  magicAttack: number
  magicDefense: number
  core: number
  heal: number
}

export interface CareerDefinition {
  id: string
  zyId: number
  name: string
  description: string
  tier: CareerTier
  rank: 1 | 2 | 3 | 4 | 5 | 6
  skillTypeIds: number[]
  growth: CareerGrowth
  levelGrowth: CareerGrowth
  requirements: CareerRequirement[]
  basicAttackSkillId: number
}

export const STARTER_CAREER_ID = 'job_1'

export const CAREERS: CareerDefinition[] = [
${lines.join(',\n')}
]

export const CAREER_GROWTH_FIELDS: Array<{ id: keyof CareerGrowth; label: string }> = [
  { id: 'physicalAttack', label: '物攻' },
  { id: 'physicalDefense', label: '物防' },
  { id: 'magicAttack', label: '法攻' },
  { id: 'magicDefense', label: '法防' },
  { id: 'core', label: '核心' },
  { id: 'heal', label: '治疗' },
]

export const careerById = (id: string): CareerDefinition | undefined =>
  CAREERS.find((career) => career.id === id)

export const careersInRank = (rank: CareerDefinition['rank']): CareerDefinition[] =>
  CAREERS.filter((career) => career.rank === rank)

export const careerCoefficientAtLevel = (
  career: CareerDefinition,
  field: keyof CareerGrowth,
  level: number,
): number => Math.round(
  (career.growth[field] + Math.max(0, level - 1) * career.levelGrowth[field]) * 100,
) / 100

export const careerSkillTypeNames = (career: CareerDefinition): string[] =>
  career.skillTypeIds.map((id) => SKILL_TYPE_NAMES[id] ?? '未知')

export const careerJobBookName = (career: CareerDefinition): string =>
  \`\${career.name}转职书\`

export const growthGrade = (coeff: number): string => {
  if (coeff >= 2.3) return 'SSS'
  if (coeff >= 2.0) return 'SS'
  if (coeff >= 1.7) return 'S'
  if (coeff >= 1.4) return 'A'
  if (coeff >= 1.2) return 'B'
  if (coeff >= 1.0) return 'C'
  if (coeff >= 0.8) return 'D'
  return 'E'
}

export const formatGrowthCoeff = (coeff: number): string =>
  coeff.toFixed(2).replace(/0+$/, '').replace(/\\.$/, '')
`

fs.writeFileSync(path.resolve(root, '../src/content/careers.ts'), out)
console.log('wrote careers.ts', lines.length)
