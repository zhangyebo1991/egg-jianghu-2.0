import { skillIconAsset } from './skill-icon-assets'
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

const careerImages = import.meta.glob<string>('../assets/careers/original/career_*.webp', { eager: true, import: 'default' })

export const careerCategoryIconAsset = (category: string): string => categoryIcons[category] ?? categoryIcons['剑']

export const careerIconAsset = (careerId: string): string => {
  const career = careerById(careerId)
  return careerImages[`../assets/careers/original/career_${career?.zyId ?? 1}.webp`]
}

export const martialIconAsset = (martialId: string): string => {
  const martial = martialByIdV10(martialId)
  return skillIconAsset(martial?.originalSkillId ?? 1)
}

export const heartMethodIconAsset = (heartMethodId: string): string => {
  const method = heartMethodByIdV10(heartMethodId)
  if (!method || method.source === 'city') return categoryIcons['内家']
  return categoryIcons['内家']
}
