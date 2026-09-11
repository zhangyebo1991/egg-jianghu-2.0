import { heroByIdV10, type HeroDefinitionV10 } from './heroes'
import { originalHeroAbilityBase } from './original-hero-abilities.generated'

export const HERO_LIFECYCLE_LABELS = {
  starter: '主角', transition: '前期过渡', chapter: '章节培养', tavern: '酒馆补位', welfare: '福利伙伴',
} as const
export type HeroLifecycleLayer = keyof typeof HERO_LIFECYCLE_LABELS

/** 定位与取得章节独立于旧品级；不改变资质、存档和招募价格。 */
export const heroLifecycle = (hero: HeroDefinitionV10) => {
  const layer: HeroLifecycleLayer = hero.source === 'starter' ? 'starter'
    : hero.sourceId === 5 || hero.sourceId === 8 ? 'transition'
      : hero.source === 'welfare' ? 'welfare' : hero.source === 'tavern' ? 'tavern' : 'chapter'
  const commerce = originalHeroAbilityBase(hero.sourceId, 7)
  const strategy = originalHeroAbilityBase(hero.sourceId, 9)
  const jobs = [commerce > 0 ? `商业${commerce} · 商店员工` : '', strategy > 0 ? `计略${strategy} · 势力代理` : ''].filter(Boolean)
  const stage = hero.source === 'starter' || hero.source === 'welfare' ? '开局可得' : `第${Number(hero.worldId.slice(-2))}章可得`
  const training = hero.sourceId === 5 ? '前期物攻过渡。已有赵云时，先比较现有培养，再决定是否投入吕布。'
    : hero.sourceId === 8 ? '前期治疗培养。需学习并装备治疗武学，不是招到就能治疗。'
      : hero.source === 'tavern' ? '低成本补充队伍；按资质和准备培养的职业选择，不因后章品级追加投入。'
        : hero.source === 'starter' ? '按当前阵容培养职业、武学和装备。'
          : hero.source === 'welfare' ? '免费物攻培养起点；仍需投入等级、职业和武学。'
            : '本章可选培养对象；先比较资质、岗位和现有阵容，再投入职业与武学。'
  const replacement = hero.sourceId === 5 ? '中期重点评估换下。赵云是可先比较的物攻伙伴，但体资质略低；以培养追平后的输出和存活决定。'
    : hero.sourceId === 8 ? '中期重点评估换下。比较有效治疗、施法速度和存活；艾莉丝目前不能视为直接升级，不按固定章节强制换人。'
      : '新伙伴等级、职业与武学追平后，再比较输出、治疗或存活。没有固定淘汰章节，取得更晚不代表更强。'
  return { layer, label: HERO_LIFECYCLE_LABELS[layer], stage, training, replacement, jobs,
    longTerm: jobs.length ? '退队后可考虑上述岗位，需满足任职条件。能力上限5，高白板可少补能力，同能力下不独占收益。' : '暂无商店或代理能力特长；是否保留战斗培养，按阵容实际表现决定。' }
}

export const heroLifecycleById = (id: string) => {
  const hero = heroByIdV10(id)
  return hero ? heroLifecycle(hero) : undefined
}
