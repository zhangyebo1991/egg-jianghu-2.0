const icons = import.meta.glob<string>('../assets/skills/original/skill_*.webp', { eager: true, import: 'default' })

/** 按原版技能编号解析图标；未知技能使用原版攻击图标。 */
export const skillIconAsset = (skillId: number): string =>
  icons[`../assets/skills/original/skill_${skillId}.webp`] ?? icons['../assets/skills/original/skill_1.webp']
