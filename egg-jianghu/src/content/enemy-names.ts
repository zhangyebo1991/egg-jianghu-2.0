import { stageEnemyGroup, type EnemyDefinition } from './enemies'

export interface ParsedEnemyId {
  worldId: string
  stage: number
  kind: 'mob' | 'boss'
  /** kind 为 mob 时是本关小怪序号 0-4，boss 时为 -1 */
  mobIndex: number
}

// 敌人身份 id：world_XX_stage_YY_mob_1..5 或 world_XX_stage_YY_boss
export const parseEnemyId = (enemyId: string): ParsedEnemyId | null => {
  const match = enemyId.match(/^(world_\d{2})_stage_(\d{2})_(?:mob_([1-5])|boss)$/)
  if (!match) return null
  return {
    worldId: match[1],
    stage: Number(match[2]),
    kind: match[3] ? 'mob' : 'boss',
    mobIndex: match[3] ? Number(match[3]) - 1 : -1,
  }
}

export const enemyDefinitionById = (enemyId: string): EnemyDefinition | undefined => {
  const parsed = parseEnemyId(enemyId)
  if (!parsed) return undefined
  const group = stageEnemyGroup(parsed.worldId, parsed.stage)
  if (!group) return undefined
  return parsed.kind === 'boss' ? group.boss : group.mobs[parsed.mobIndex]
}

export const enemyDisplayName = (enemyId: string): string =>
  enemyDefinitionById(enemyId)?.name ?? '未知目标'
