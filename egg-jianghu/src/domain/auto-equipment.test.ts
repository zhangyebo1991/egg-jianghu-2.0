import { describe, expect, it } from 'vitest'
import { equipmentDefinitionById } from '../content/equipment'
import { equipBestEquipment, equipEquipment, switchEquipmentSet } from './inventory'
import { createHeroProgress, createNewGameStateV10 } from './state'
import type { EquipmentInstance } from './types'

const item = (uid: string, definitionId = 'wp_101', level = 1): EquipmentInstance => ({
  uid, definitionId, level, equipmentLevel: 1, quality: 0, locked: false,
  coreStats: equipmentDefinitionById(definitionId)!.coreStats.map((stat) => ({ attributeId: stat.attributeId, coefficient: stat.baseCoefficient })),
  affixes: [],
})
const setup = () => {
  const state = createNewGameStateV10('一键穿戴')
  state.heroes.hero_player.level = 50
  state.inventory = []
  return state
}

describe('一键穿戴', () => {
  it('切换物理和法术方向，通用部位保留最强装备', () => {
    const state = setup()
    state.inventory = [item('physical'), item('magical', 'wp_103'), item('shield', 'wp_106')]
    expect(equipBestEquipment(state, 'hero_player', 'physical').ok).toBe(true)
    expect(state.heroes.hero_player.equipmentBySlot).toMatchObject({ weapon: 'physical', offhand: 'shield' })
    equipBestEquipment(state, 'hero_player', 'magical')
    expect(state.heroes.hero_player.equipmentBySlot).toMatchObject({ weapon: 'magical', offhand: 'shield' })
  })

  it('核心实际数值优先于品质和附加词条，物品等级参与结算', () => {
    const state = setup()
    const weak = item('weak')
    weak.quality = 9
    weak.affixes = [{ attributeId: 8, coefficient: 10000 }]
    state.inventory = [weak, item('strong', 'wp_101', 20)]
    equipBestEquipment(state, 'hero_player', 'physical')
    expect(state.heroes.hero_player.equipmentBySlot.weapon).toBe('strong')
  })

  it('核心相同再比本流派附词条，完全同分保留当前装备', () => {
    const state = setup()
    const useful = item('useful')
    useful.affixes = [{ attributeId: 20, coefficient: 100 }]
    const wrong = item('wrong')
    wrong.affixes = [{ attributeId: 22, coefficient: 1000 }]
    state.inventory = [wrong, useful, { ...useful, uid: 'equal' }]
    equipBestEquipment(state, 'hero_player', 'physical')
    expect(state.heroes.hero_player.equipmentBySlot.weapon).toBe('useful')
    expect(equipBestEquipment(state, 'hero_player', 'physical').message).toContain('当前已是')
    expect(state.heroes.hero_player.equipmentBySlot.weapon).toBe('useful')
  })

  it('跳过等级不足、其他侠客和备用方案占用的装备，保留至宝', () => {
    const state = setup()
    state.heroes.other = createHeroProgress('career_warrior')
    state.heroes.other.level = 50
    state.inventory = [item('available'), item('reserved', 'wp_101', 10), item('other', 'wp_101', 20), { ...item('high', 'wp_101', 50), equipmentLevel: 51 }]
    equipEquipment(state, 'other', 'other')
    switchEquipmentSet(state, 'hero_player', 1)
    equipEquipment(state, 'hero_player', 'reserved')
    switchEquipmentSet(state, 'hero_player', 0)
    state.heroes.hero_player.equipmentBySlot.treasure = 'existing-treasure'
    equipBestEquipment(state, 'hero_player', 'physical')
    expect(state.heroes.hero_player.equipmentBySlot).toMatchObject({ weapon: 'available', treasure: 'existing-treasure' })
    expect(state.heroes.hero_player.equipmentSets[1].weapon).toBe('reserved')
    expect(state.heroes.other.equipmentBySlot.weapon).toBe('other')
  })

  it('没有同流派装备时不卸掉现有装备，不给空槽装上另一流派武器', () => {
    const state = setup()
    state.inventory = [item('physical')]
    equipBestEquipment(state, 'hero_player', 'magical')
    expect(state.heroes.hero_player.equipmentBySlot.weapon).toBeUndefined()
    equipEquipment(state, 'hero_player', 'physical')
    equipBestEquipment(state, 'hero_player', 'magical')
    expect(state.heroes.hero_player.equipmentBySlot.weapon).toBe('physical')
    expect(equipBestEquipment(state, 'missing', 'physical').ok).toBe(false)
  })
})
