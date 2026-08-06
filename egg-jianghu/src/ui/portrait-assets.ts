import heroABi from '../assets/heroes/hero_a_bi.png'
import heroAZhu from '../assets/heroes/hero_a_zhu.png'
import heroBaoXiruo from '../assets/heroes/hero_bao_xiruo.png'
import heroDuanYu from '../assets/heroes/hero_duan_yu.png'
import heroDuanZhengchun from '../assets/heroes/hero_duan_zhengchun.png'
import heroGuoFu from '../assets/heroes/hero_guo_fu.png'
import heroGuoJing from '../assets/heroes/hero_guo_jing.png'
import heroGuoXiaotian from '../assets/heroes/hero_guo_xiaotian.png'
import heroHuazheng from '../assets/heroes/hero_huazheng.png'
import heroJiuMozhi from '../assets/heroes/hero_jiu_mozhi.png'
import heroKangMin from '../assets/heroes/hero_kang_min.png'
import heroLiPing from '../assets/heroes/hero_li_ping.png'
import heroMuWanqing from '../assets/heroes/hero_mu_wanqing.png'
import heroMuNianci from '../assets/heroes/hero_mu_nianci.png'
import heroMurongBo from '../assets/heroes/hero_murong_bo.png'
import heroPlayer from '../assets/heroes/hero_player.png'
import heroQinHongmian from '../assets/heroes/hero_qin_hongmian.png'
import heroRuanXingzhu from '../assets/heroes/hero_ruan_xingzhu.png'
import heroTuolei from '../assets/heroes/hero_tuolei.png'
import heroWanPing from '../assets/heroes/hero_wan_ping.png'
import heroWangFuren from '../assets/heroes/hero_wang_furen.png'
import heroWangYuyan from '../assets/heroes/hero_wang_yuyan.png'
import heroXiaoZhao from '../assets/heroes/hero_xiao_zhao.png'
import heroXieXun from '../assets/heroes/hero_xie_xun.png'
import heroXueMuhua from '../assets/heroes/hero_xue_muhua.png'
import heroYangTiexin from '../assets/heroes/hero_yang_tiexin.png'
import heroYelvYang from '../assets/heroes/hero_yelv_yang.png'
import heroYouTanzhi from '../assets/heroes/hero_you_tanzhi.png'
import heroZhaoMin from '../assets/heroes/hero_zhao_min.png'
import heroZhebie from '../assets/heroes/hero_zhebie.png'
import heroZhongLing from '../assets/heroes/hero_zhong_ling.png'
import genericBlade from '../assets/heroes/generic_blade.png'
import genericDoctor from '../assets/heroes/generic_doctor.png'
import genericFist from '../assets/heroes/generic_fist.png'
import genericInner from '../assets/heroes/generic_inner.png'
import genericShadow from '../assets/heroes/generic_shadow.png'
import genericSword from '../assets/heroes/generic_sword.png'
import boss1 from '../assets/enemies/boss_1.png'
import boss2 from '../assets/enemies/boss_2.png'
import elite1 from '../assets/enemies/elite_1.png'
import elite2 from '../assets/enemies/elite_2.png'
import normal1 from '../assets/enemies/normal_1.png'
import normal2 from '../assets/enemies/normal_2.png'
import normal3 from '../assets/enemies/normal_3.png'
import type { CombatRank } from '../combat/types'

const heroPortraits: Record<string, string> = {
  hero_player: heroPlayer,
  hero_guo_jing: heroGuoJing,
  hero_yang_tiexin: heroYangTiexin,
  hero_mu_nianci: heroMuNianci,
  hero_zhebie: heroZhebie,
  hero_tuolei: heroTuolei,
  hero_huazheng: heroHuazheng,
  hero_guo_xiaotian: heroGuoXiaotian,
  hero_bao_xiruo: heroBaoXiruo,
  hero_li_ping: heroLiPing,
  hero_kang_min: heroKangMin,
  hero_qin_hongmian: heroQinHongmian,
  hero_wang_furen: heroWangFuren,
  hero_mu_wanqing: heroMuWanqing,
  hero_wang_yuyan: heroWangYuyan,
  hero_duan_zhengchun: heroDuanZhengchun,
  hero_guo_fu: heroGuoFu,
  hero_wan_ping: heroWanPing,
  hero_yelv_yang: heroYelvYang,
  hero_zhao_min: heroZhaoMin,
  hero_xie_xun: heroXieXun,
  hero_xiao_zhao: heroXiaoZhao,
  hero_duan_yu: heroDuanYu,
  hero_zhong_ling: heroZhongLing,
  hero_ruan_xingzhu: heroRuanXingzhu,
  hero_a_zhu: heroAZhu,
  hero_a_bi: heroABi,
  hero_you_tanzhi: heroYouTanzhi,
  hero_jiu_mozhi: heroJiuMozhi,
  hero_murong_bo: heroMurongBo,
  hero_xue_muhua: heroXueMuhua,
}

// 脉系通用头像：势力门人等无专属头像的侠客按职业脉系回退
const genericPortraits: Record<string, string> = {
  剑: genericSword,
  刀: genericBlade,
  拳: genericFist,
  暗: genericShadow,
  医: genericDoctor,
  内家: genericInner,
}

export interface PortraitAsset {
  url: string
  source: 'unique' | 'generic'
}

export const heroPortraitAsset = (heroId: string, category = '剑'): PortraitAsset => {
  const unique = heroPortraits[heroId]
  return unique
    ? { url: unique, source: 'unique' }
    : { url: genericPortraits[category] ?? genericPortraits['剑'], source: 'generic' }
}

const enemyPortraits: Record<CombatRank, readonly string[]> = {
  normal: [normal1, normal2, normal3],
  elite: [elite1, elite2],
  boss: [boss1, boss2],
}

// 同档次敌人按单位 id 稳定分配不同形象，避免一波敌人清一色重复
export const enemyPortraitAsset = (rank: CombatRank, unitKey: string): PortraitAsset => {
  const variants = enemyPortraits[rank]
  const hash = [...unitKey].reduce((total, char) => total + char.charCodeAt(0), 0)
  return { url: variants[hash % variants.length], source: 'generic' }
}
