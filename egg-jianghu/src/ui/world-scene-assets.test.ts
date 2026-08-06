import { describe, expect, it } from 'vitest'
import { RELEASED_WORLD_COUNT, WORLDS } from '../content/worlds'
import { worldSceneAsset } from './world-scene-assets'

describe('世界场景图资源', () => {
  it('已开放的江湖卷各有独立场景图', () => {
    const released = WORLDS.filter((world) => world.released)
    expect(released).toHaveLength(RELEASED_WORLD_COUNT)
    const scenes = released.map((world) => worldSceneAsset(world.id))
    expect(scenes.every((scene) => scene?.endsWith('.webp'))).toBe(true)
    expect(new Set(scenes).size).toBe(RELEASED_WORLD_COUNT)
  })

  it('未开放卷没有场景图', () => {
    expect(worldSceneAsset('world_11')).toBeNull()
    expect(worldSceneAsset('world_30')).toBeNull()
  })
})
