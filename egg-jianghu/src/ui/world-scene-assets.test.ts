import { describe, expect, it } from 'vitest'
import { RELEASED_WORLD_COUNT, WORLDS } from '../content/worlds'
import { worldSceneAsset } from './world-scene-assets'

describe('世界场景图资源', () => {
  it('前十个位面各有独立场景图，后三面可无图', () => {
    const withScenes = WORLDS.slice(0, 10)
    expect(WORLDS).toHaveLength(RELEASED_WORLD_COUNT)
    const scenes = withScenes.map((world) => worldSceneAsset(world.id))
    expect(scenes.every((scene) => scene?.endsWith('.webp'))).toBe(true)
    expect(new Set(scenes).size).toBe(10)
  })

  it('后三位面可以没有独立场景图', () => {
    expect(worldSceneAsset('world_11') === null || worldSceneAsset('world_11')?.endsWith('.webp')).toBe(true)
    expect(worldSceneAsset('world_99')).toBeNull()
  })
})
