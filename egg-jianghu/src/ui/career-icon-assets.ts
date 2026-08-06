import bladeIcon from '../assets/careers/blade.png'
import doctorIcon from '../assets/careers/doctor.png'
import fistIcon from '../assets/careers/fist.png'
import innerIcon from '../assets/careers/inner.png'
import shadowIcon from '../assets/careers/shadow.png'
import swordIcon from '../assets/careers/sword.png'
import bladeFuryIcon from '../assets/martials/blade_fury.png'
import bladeSwiftIcon from '../assets/martials/blade_swift.png'
import doctorHealIcon from '../assets/martials/doctor_heal.png'
import doctorMedicineIcon from '../assets/martials/doctor_medicine.png'
import fistHardIcon from '../assets/martials/fist_hard.png'
import fistSoftIcon from '../assets/martials/fist_soft.png'
import innerFlowIcon from '../assets/martials/inner_flow.png'
import innerGuardIcon from '../assets/martials/inner_guard.png'
import shadowAssassinIcon from '../assets/martials/shadow_assassin.png'
import shadowPoisonIcon from '../assets/martials/shadow_poison.png'
import swordHeavyIcon from '../assets/martials/sword_heavy.png'
import swordSwiftIcon from '../assets/martials/sword_swift.png'
import { careerById } from '../content/careers'
import { heartMethodByIdV10, martialByIdV10 } from '../content/martials'

const categoryIcons: Record<string, string> = {
  剑: swordIcon,
  刀: bladeIcon,
  拳: fistIcon,
  暗: shadowIcon,
  医: doctorIcon,
  内家: innerIcon,
}

const branchIcons: Record<string, string> = {
  sword_swift: swordSwiftIcon,
  sword_heavy: swordHeavyIcon,
  blade_swift: bladeSwiftIcon,
  blade_fury: bladeFuryIcon,
  fist_hard: fistHardIcon,
  fist_soft: fistSoftIcon,
  shadow_assassin: shadowAssassinIcon,
  shadow_poison: shadowPoisonIcon,
  doctor_heal: doctorHealIcon,
  doctor_medicine: doctorMedicineIcon,
  inner_flow: innerFlowIcon,
  inner_guard: innerGuardIcon,
}

// 与 careers.ts / factions.ts 的分支顺序一致：每脉第一分支在前、第二分支在后
const branchIdByCategory: Record<string, readonly [string, string]> = {
  剑: ['sword_swift', 'sword_heavy'],
  刀: ['blade_swift', 'blade_fury'],
  拳: ['fist_hard', 'fist_soft'],
  暗: ['shadow_assassin', 'shadow_poison'],
  医: ['doctor_heal', 'doctor_medicine'],
  内家: ['inner_flow', 'inner_guard'],
}

// 脉系类别图标（势力牌匾、筛选项等按类别直接取用）
export const careerCategoryIconAsset = (category: string): string => categoryIcons[category] ?? categoryIcons['剑']

// 职业图标：初级职业按脉系类别，分支职业（*_mid/_high/_top）按所属分支
export const careerIconAsset = (careerId: string): string => {
  const career = careerById(careerId)
  if (!career) return categoryIcons['剑']
  if (career.branch === null) return categoryIcons[career.category]
  return branchIcons[careerId.replace(/_(mid|high|top)$/, '')] ?? categoryIcons[career.category]
}

// 武功图标：城市通用武功按脉系类别，势力武功按所属分支
export const martialIconAsset = (martialId: string): string => {
  const martial = martialByIdV10(martialId)
  if (!martial) return categoryIcons['剑']
  if (martial.source === 'city') return categoryIcons[martial.category]
  const branchId = branchIdByCategory[martial.category]?.[martial.branchIndex - 1]
  return (branchId ? branchIcons[branchId] : undefined) ?? categoryIcons[martial.category]
}

// 心法图标：势力心法按脉系类别，城市通用心法统归内家
export const heartMethodIconAsset = (heartMethodId: string): string => {
  const method = heartMethodByIdV10(heartMethodId)
  if (!method || method.source === 'city') return categoryIcons['内家']
  const category = careerById(method.careerIds[0] ?? '')?.category
  return categoryIcons[category ?? '内家'] ?? categoryIcons['内家']
}
