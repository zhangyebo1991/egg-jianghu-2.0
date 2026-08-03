import { FACTIONS } from './factions'

export const RELEASED_WORLD_COUNT = 10

export interface WorldDefinition {
  id: string
  name: string
  index: number
  released: boolean
  currencyId: string
  factionIds: string[]
  stageIds: string[]
}

export const WORLD_NAMES = [
  '牛家村', '嘉兴', '归云庄', '大理', '无量山',
  '风陵渡', '蝴蝶谷', '姑苏', '聚贤庄', '擂鼓山',
  '恒山', '桃花岛', '终南山', '铁掌峰', '雁门关',
  '白驼山', '梅庄', '绝情谷', '星宿海', '冰火岛',
  '神龙岛', '剑冢', '灵鹫宫', '光明顶', '万安寺',
  '襄阳', '少室山', '黑木崖', '华山', '侠客岛',
] as const

export const WORLDS: WorldDefinition[] = WORLD_NAMES.map((name, offset) => {
  const index = offset + 1
  const id = `world_${String(index).padStart(2, '0')}`
  const released = index <= RELEASED_WORLD_COUNT
  return {
    id,
    name,
    index,
    released,
    currencyId: id,
    factionIds: released
      ? FACTIONS.filter((faction) => faction.worldId === id).map((faction) => faction.id)
      : [],
    stageIds: released
      ? Array.from({ length: 10 }, (_, stageOffset) => `${id}_stage_${String(stageOffset + 1).padStart(2, '0')}`)
      : [],
  }
})

export const worldById = (id: string): WorldDefinition | undefined =>
  WORLDS.find((world) => world.id === id)
