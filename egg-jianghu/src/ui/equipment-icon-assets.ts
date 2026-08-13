import armorIcon from '../assets/equipment/slots/armor.png'
import bootsIcon from '../assets/equipment/slots/boots.png'
import headIcon from '../assets/equipment/slots/head.png'
import necklaceIcon from '../assets/equipment/slots/waist.png'
import offhandIcon from '../assets/equipment/slots/offhand.png'
import ringIcon from '../assets/equipment/slots/token.png'
import weaponIcon from '../assets/equipment/slots/weapon.png'
import wristIcon from '../assets/equipment/slots/wrist.png'
import type { EquipmentSlot } from '../content/equipment'

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

// 后续新增装备专属图标时，在此导入资源并以 definitionId 注册；未注册装备自动回退到部位通用图标。
const uniqueEquipmentIcons: Partial<Record<string, string>> = {}

export interface EquipmentIconAsset {
  url: string
  source: 'unique' | 'slot'
}

export const equipmentIconAsset = (slot: EquipmentSlot, definitionId?: string): EquipmentIconAsset => {
  const uniqueIcon = definitionId ? uniqueEquipmentIcons[definitionId] : undefined
  return uniqueIcon
    ? { url: uniqueIcon, source: 'unique' }
    : { url: slotIcons[slot], source: 'slot' }
}
