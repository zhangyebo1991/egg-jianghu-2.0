import armorIcon from '../assets/equipment/slots/armor.png'
import bootsIcon from '../assets/equipment/slots/boots.png'
import headIcon from '../assets/equipment/slots/head.png'
import necklaceIcon from '../assets/equipment/slots/waist.png'
import offhandIcon from '../assets/equipment/slots/offhand.png'
import ringIcon from '../assets/equipment/slots/token.png'
import weaponIcon from '../assets/equipment/slots/weapon.png'
import wristIcon from '../assets/equipment/slots/wrist.png'
import { equipmentDefinitionById, type EquipmentSlot } from '../content/equipment'

const slotIcons: Record<EquipmentSlot, string> = {
  weapon: weaponIcon,
  offhand: offhandIcon,
  head: headIcon,
  armor: armorIcon,
  wrist: wristIcon,
  boots: bootsIcon,
  necklace: necklaceIcon,
  ring: ringIcon,
}

const equipmentIconModules = import.meta.glob<string>('../assets/equipment/zt/zt_eq_*.webp', {
  eager: true,
  import: 'default',
})

const uniqueEquipmentIcons = Object.fromEntries(Object.entries(equipmentIconModules).map(([path, url]) => {
  const iconKey = path.match(/\/([^/]+)\.webp$/)?.[1]
  if (!iconKey) throw new Error(`无法解析装备图标资源名：${path}`)
  return [iconKey, url]
})) as Record<string, string>

export interface EquipmentIconAsset {
  url: string
  source: 'unique' | 'slot'
}

export const equipmentIconAsset = (slot: EquipmentSlot, definitionId?: string): EquipmentIconAsset => {
  const iconKey = definitionId ? equipmentDefinitionById(definitionId)?.iconKey : undefined
  const uniqueIcon = iconKey ? uniqueEquipmentIcons[iconKey] : undefined
  return uniqueIcon
    ? { url: uniqueIcon, source: 'unique' }
    : { url: slotIcons[slot], source: 'slot' }
}
