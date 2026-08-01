import { describe, expect, it } from 'vitest'
import { resolveDefeat, resolveVictory } from './progression'

describe('驻守与闯荡推进', () => {
  it('闯荡失败切驻守并按规则回退', () => {
    expect(resolveDefeat({ worldId: 'world_01', stage: 6, mode: 'roam' })).toEqual({
      worldId: 'world_01', stage: 5, mode: 'guard',
    })
    expect(resolveDefeat({ worldId: 'world_01', stage: 1, mode: 'roam' })).toEqual({
      worldId: 'world_01', stage: 1, mode: 'guard',
    })
  })

  it('驻守通关重开本关，闯荡通关推进下一关', () => {
    expect(resolveVictory({ worldId: 'world_01', stage: 4, mode: 'guard' })).toEqual({
      worldId: 'world_01', stage: 4, mode: 'guard',
    })
    expect(resolveVictory({ worldId: 'world_01', stage: 4, mode: 'roam' })).toEqual({
      worldId: 'world_01', stage: 5, mode: 'roam',
    })
  })

  it('第十关闯荡通关进入下一卷第一关', () => {
    expect(resolveVictory({ worldId: 'world_01', stage: 10, mode: 'roam' })).toEqual({
      worldId: 'world_02', stage: 1, mode: 'roam',
    })
    expect(resolveVictory({ worldId: 'world_10', stage: 10, mode: 'roam' })).toEqual({
      worldId: 'world_10', stage: 10, mode: 'guard',
    })
  })
})
