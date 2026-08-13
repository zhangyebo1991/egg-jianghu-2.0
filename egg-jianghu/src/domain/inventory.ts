import type { ActionResult, EquipmentInstance, EquipmentQuality, GameStateV10, HeroProgressV10 } from './types'
import {
  EQUIPMENT_QUALITIES,
  EQUIPMENT_SET_COUNT,
  EQUIPMENT_SLOTS,
  canonicalEquipmentDefinitionId,
  canonicalEquipmentSlot,
  equipmentDefinitionById,
  isEquipmentSetIndex,
  type EquipmentSetIndex,
} from '../content/equipment'

export const INVENTORY_CAPACITY = 300

export type AddEquipmentResult = { ok: true } | { ok: false; reason: 'inventory-full' }

const remapLoadoutInPlace = (raw: Record<string, string | null>): Record<string, string | null> => {
  for (const [slot, uid] of Object.entries(raw)) {
    const canonical = canonicalEquipmentSlot(slot)
    if (!canonical) {
      delete raw[slot]
      continue
    }
    if (canonical !== slot) {
      if (raw[canonical] == null) raw[canonical] = uid
      delete raw[slot]
    }
  }
  return raw
}

export const normalizeHeroEquipment = (hero: HeroProgressV10): void => {
  const sourceSets = Array.isArray(hero.equipmentSets) && hero.equipmentSets.length > 0
    ? [...hero.equipmentSets]
    : [hero.equipmentBySlot ?? {}]
  while (sourceSets.length < EQUIPMENT_SET_COUNT) sourceSets.push({})
  const equipmentSets = [0, 1, 2].map((index) => remapLoadoutInPlace(sourceSets[index] ?? {})) as HeroProgressV10['equipmentSets']
  const requestedIndex = hero.activeEquipmentSetIndex
  const activeEquipmentSetIndex: EquipmentSetIndex = isEquipmentSetIndex(requestedIndex) ? requestedIndex : 0
  hero.equipmentSets = equipmentSets
  hero.activeEquipmentSetIndex = activeEquipmentSetIndex
  hero.equipmentBySlot = equipmentSets[activeEquipmentSetIndex]
}

export const normalizeInventoryDefinitionIds = (inventory: EquipmentInstance[]): void => {
  for (const item of inventory) {
    item.definitionId = canonicalEquipmentDefinitionId(item.definitionId)
  }
}

export const bindActiveEquipmentLoadout = (hero: HeroProgressV10): Record<string, string | null> => {
  normalizeHeroEquipment(hero)
  return hero.equipmentBySlot
}

const heroLoadouts = (hero: HeroProgressV10): Array<Record<string, string | null>> => {
  normalizeHeroEquipment(hero)
  return hero.equipmentSets
}

const releaseEquipmentFromHero = (hero: HeroProgressV10, uid: string): void => {
  for (const loadout of heroLoadouts(hero)) {
    for (const [slot, equippedUid] of Object.entries(loadout)) {
      if (equippedUid === uid) loadout[slot] = null
    }
  }
}

// inventory 保存全部装备实例；物品栏仅包含尚未被侠客穿戴的装备。
export const backpackEquipment = (state: GameStateV10): EquipmentInstance[] =>
  state.inventory.filter((item) => equipmentOwnerId(state, item.uid) === null)

export const addEquipment = (
  state: GameStateV10,
  equipment: EquipmentInstance,
): AddEquipmentResult => {
  if (backpackEquipment(state).length >= INVENTORY_CAPACITY) {
    state.statistics.equipmentMissedAtCapacity += 1
    return { ok: false, reason: 'inventory-full' }
  }
  if (state.inventory.some((item) => item.uid === equipment.uid)) {
    throw new Error(`重复装备 uid: ${equipment.uid}`)
  }
  state.inventory.push(equipment)
  return { ok: true }
}

export const equipEquipment = (
  state: GameStateV10,
  heroId: string,
  equipmentUid: string,
): ActionResult => {
  const hero = state.heroes[heroId]
  const equipment = state.inventory.find((item) => item.uid === equipmentUid)
  if (!hero?.recruited) return { ok: false, message: '侠客尚未加入' }
  if (!equipment) return { ok: false, message: '装备不存在' }
  const definition = equipmentDefinitionById(canonicalEquipmentDefinitionId(equipment.definitionId))
  if (!definition) return { ok: false, message: '装备部位定义不存在' }
  const ownerId = equipmentOwnerId(state, equipmentUid)
  if (ownerId && ownerId !== heroId) return { ok: false, message: '装备已被其他侠客穿戴' }
  const loadout = bindActiveEquipmentLoadout(hero)
  if (loadout[definition.slot] === equipmentUid) return { ok: false, message: '装备已经穿戴' }

  releaseEquipmentFromHero(hero, equipmentUid)
  loadout[definition.slot] = equipmentUid
  return { ok: true, message: '装备成功' }
}

export const unequipEquipment = (
  state: GameStateV10,
  heroId: string,
  slot: string,
): ActionResult => {
  const hero = state.heroes[heroId]
  if (!hero?.recruited) return { ok: false, message: '侠客尚未加入' }
  const canonicalSlot = canonicalEquipmentSlot(slot)
  const loadout = bindActiveEquipmentLoadout(hero)
  if (!canonicalSlot || !loadout[canonicalSlot]) return { ok: false, message: '该部位没有装备' }
  if (backpackEquipment(state).length >= INVENTORY_CAPACITY) {
    return { ok: false, message: '物品栏已满，无法卸下装备' }
  }
  loadout[canonicalSlot] = null
  return { ok: true, message: '已卸下装备' }
}

export const switchEquipmentSet = (
  state: GameStateV10,
  heroId: string,
  setIndex: number,
): ActionResult => {
  const hero = state.heroes[heroId]
  if (!hero?.recruited) return { ok: false, message: '侠客尚未加入' }
  if (!isEquipmentSetIndex(setIndex)) return { ok: false, message: '装备方案不存在' }
  bindActiveEquipmentLoadout(hero)
  hero.activeEquipmentSetIndex = setIndex
  hero.equipmentBySlot = hero.equipmentSets[setIndex]
  return { ok: true, message: `已切换至第${setIndex + 1}套装备` }
}

export const toggleEquipmentLock = (state: GameStateV10, equipmentUid: string): ActionResult => {
  const equipment = state.inventory.find((item) => item.uid === equipmentUid)
  if (!equipment) return { ok: false, message: '装备不存在' }
  equipment.locked = !equipment.locked
  return { ok: true, message: equipment.locked ? '装备已锁定' : '装备已解锁' }
}

export const discardEquipment = (state: GameStateV10, equipmentUid: string): ActionResult => {
  const equipment = state.inventory.find((item) => item.uid === equipmentUid)
  if (!equipment) return { ok: false, message: '装备不存在' }
  if (equipment.locked) return { ok: false, message: '此物已上锁，先解锁再丢弃' }
  if (isEquipmentEquipped(state, equipmentUid)) return { ok: false, message: '已穿戴装备请先到侠客页卸下' }

  state.inventory = state.inventory.filter((item) => item.uid !== equipmentUid)
  return { ok: true, message: `已丢弃 ${equipmentDefinitionById(canonicalEquipmentDefinitionId(equipment.definitionId))?.name ?? '装备'}` }
}

export const organizeInventory = (state: GameStateV10): ActionResult => {
  state.inventory.sort((left, right) => {
    const leftDefinition = equipmentDefinitionById(canonicalEquipmentDefinitionId(left.definitionId))
    const rightDefinition = equipmentDefinitionById(canonicalEquipmentDefinitionId(right.definitionId))
    const slotDifference = EQUIPMENT_SLOTS.indexOf(leftDefinition?.slot ?? 'ring')
      - EQUIPMENT_SLOTS.indexOf(rightDefinition?.slot ?? 'ring')
    if (slotDifference !== 0) return slotDifference
    const qualityDifference = EQUIPMENT_QUALITIES.indexOf(right.quality) - EQUIPMENT_QUALITIES.indexOf(left.quality)
    if (qualityDifference !== 0) return qualityDifference
    if (left.level !== right.level) return right.level - left.level
    const definitionDifference = left.definitionId.localeCompare(right.definitionId)
    return definitionDifference || left.uid.localeCompare(right.uid)
  })
  return { ok: true, message: '物品已按部位、品质和等级整理' }
}

// 返回穿戴该装备的侠客 id，未穿戴则 null（任意一套占用即视为穿戴）
export const equipmentOwnerId = (state: GameStateV10, uid: string): string | null => {
  for (const [heroId, progress] of Object.entries(state.heroes)) {
    for (const loadout of heroLoadouts(progress)) {
      if (Object.values(loadout).includes(uid)) return heroId
    }
  }
  return null
}

// 判断装备是否正被某位侠客穿戴
const isEquipmentEquipped = (state: GameStateV10, uid: string): boolean =>
  equipmentOwnerId(state, uid) !== null

export const discardEquipmentByQuality = (
  state: GameStateV10,
  maxQuality: EquipmentQuality,
): ActionResult => {
  const maxIndex = EQUIPMENT_QUALITIES.indexOf(maxQuality)
  const discarded = state.inventory.filter((item) =>
    EQUIPMENT_QUALITIES.indexOf(item.quality) <= maxIndex
    && !item.locked
    && !isEquipmentEquipped(state, item.uid))
  if (discarded.length === 0) return { ok: false, message: '没有可丢弃的装备' }
  const removed = new Set(discarded.map((item) => item.uid))
  state.inventory = state.inventory.filter((item) => !removed.has(item.uid))
  return { ok: true, message: `已丢弃 ${discarded.length} 件${maxQuality}及以下装备` }
}

export const averageItemLevel = (hero: HeroProgressV10, inventory: EquipmentInstance[]): number => {
  const loadout = bindActiveEquipmentLoadout(hero)
  const total = EQUIPMENT_SLOTS.reduce((sum, slot) => {
    const uid = loadout[slot]
    const item = uid ? inventory.find((candidate) => candidate.uid === uid) : undefined
    return sum + (item?.level ?? 0)
  }, 0)
  return Math.floor(total / EQUIPMENT_SLOTS.length)
}
