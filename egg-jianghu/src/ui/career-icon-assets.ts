import bladeIcon from '../assets/careers/blade.png'
import doctorIcon from '../assets/careers/doctor.png'
import fistIcon from '../assets/careers/fist.png'
import innerIcon from '../assets/careers/inner.png'
import shadowIcon from '../assets/careers/shadow.png'
import swordIcon from '../assets/careers/sword.png'
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

const skillTypeIcons: Record<number, string> = {
  1: swordIcon,
  2: fistIcon,
  3: bladeIcon,
  4: innerIcon,
  5: shadowIcon,
  6: doctorIcon,
  7: fistIcon,
  8: innerIcon,
  9: bladeIcon,
  10: shadowIcon,
  11: innerIcon,
  12: innerIcon,
  13: shadowIcon,
  14: fistIcon,
  15: doctorIcon,
  16: doctorIcon,
}

export const careerCategoryIconAsset = (category: string): string => categoryIcons[category] ?? categoryIcons['剑']

export const careerIconAsset = (careerId: string): string => {
  const career = careerById(careerId)
  return skillTypeIcons[career?.skillTypeIds[0] ?? 1] ?? swordIcon
}

export const martialIconAsset = (martialId: string): string => {
  const martial = martialByIdV10(martialId)
  if (!martial) return categoryIcons['剑']
  return categoryIcons[martial.category] ?? categoryIcons['剑']
}

export const heartMethodIconAsset = (heartMethodId: string): string => {
  const method = heartMethodByIdV10(heartMethodId)
  if (!method || method.source === 'city') return categoryIcons['内家']
  return categoryIcons['内家']
}
