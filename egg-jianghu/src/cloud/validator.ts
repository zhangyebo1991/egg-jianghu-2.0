import { hydrateStateV10, exportSaveV10 } from '../domain/save-v10'
export const validateSave = (raw: unknown) => {
  const state = hydrateStateV10(raw)
  const player = state.heroes.hero_player
  if (!player?.recruited) throw new Error('缺少玩家角色')
  const json = exportSaveV10(state, state.lastSavedAt)
  return { json, summary: {
    name: player.customName ?? '少侠', level: player.level,
    version: state.version, savedAt: state.lastSavedAt,
    progress: Object.values(state.clearedStageByWorldDifficulty).reduce((sum, n) => sum + n, 0),
  } }
}
