import { evidenceMeta, type EvidenceLevel } from '../data/research'

export default function EvidenceLegend() {
  return (
    <div className="evidence-legend">
      <p className="kicker">EVIDENCE LEVEL</p>
      {(Object.keys(evidenceMeta) as EvidenceLevel[]).map((level) => (
        <div className="legend-row" key={level}>
          <span className={`confidence-chip confidence-${level}`}>{level}</span>
          <span>{evidenceMeta[level].label}</span>
        </div>
      ))}
      <p className="legend-note">公式与数值保留版本敏感标记，不把玩家实测包装成官方承诺。</p>
    </div>
  )
}
