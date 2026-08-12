import { useState } from 'react'
import TabList, { type TabItem } from '../TabList'
import { codexStats } from '../../data/codex'
import { CODEX_SECTIONS, type CodexSectionId } from '../../data/codexSections'
import FactionView from './FactionView'
import SkillView from './SkillView'
import CharacterView from './CharacterView'
import PassiveView from './PassiveView'
import ItemView from './ItemView'

/**
 * 技能图鉴面板：作为「诸天刷宝录」研究主题下的一个二级 section。
 * 内部再用 5 个子入口（势力 / 技能 / 角色 / 被动 / 物品）切换，子入口状态由本组件持有，
 * 切到其他 section 后再切回会重置回默认「势力技能」。
 */
export default function CodexPanel() {
  const [section, setSection] = useState<CodexSectionId>('factions')

  const tabs: TabItem[] = CODEX_SECTIONS.map((s) => ({
    id: s.id,
    label: s.label,
    eyebrow: s.eyebrow,
    accent: s.accent,
    count:
      s.id === 'factions'
        ? codexStats.factionCount
        : s.id === 'skills'
          ? codexStats.skillCount
          : s.id === 'characters'
            ? codexStats.characterCount
            : s.id === 'passives'
              ? codexStats.passiveCount
              : codexStats.itemCount,
  }))

  return (
    <div className="codex-panel">
      <div className="codex-intro">
        <div>
          <span className="kicker">CODEX · 诸天刷宝录解包数据</span>
          <h2>技能图鉴</h2>
          <p>
            基于《诸天刷宝录》游戏包内数据表解包（证据等级 A）。覆盖 {codexStats.factionCount} 个势力、
            {codexStats.skillCount} 个技能、{codexStats.passiveCount} 个通用被动、
            {codexStats.characterCount} 名角色与 {codexStats.itemCount} 件物品。技能元素/威力/CD/范围等字段
            来自技能表列映射，角色按势力归属归类，物品属通用系统。
          </p>
        </div>
        <div className="codex-intro-stats">
          <div>
            <strong>{codexStats.factionCount}</strong>
            <span>势力</span>
          </div>
          <div>
            <strong>{codexStats.seriesCount}</strong>
            <span>系列</span>
          </div>
          <div>
            <strong>{codexStats.skillCount}</strong>
            <span>技能</span>
          </div>
          <div>
            <strong>{codexStats.characterCount}</strong>
            <span>角色</span>
          </div>
        </div>
      </div>

      <TabList
        tabs={tabs}
        activeId={section}
        onSelect={(id) => setSection(id as CodexSectionId)}
        label="图鉴入口"
        panelId="codex"
        variant="section"
      />

      <div className="codex-body" role="tabpanel" id="codex-panel-main" aria-labelledby="codex-tab-factions">
        {section === 'factions' && <FactionView />}
        {section === 'skills' && <SkillView />}
        {section === 'characters' && <CharacterView />}
        {section === 'passives' && <PassiveView />}
        {section === 'items' && <ItemView />}
      </div>
    </div>
  )
}
