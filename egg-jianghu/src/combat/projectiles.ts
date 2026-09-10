import type { CombatUnit } from './types'

/** 原版生成阵位，以中点为原点；弹体速度2000，尺寸100，核心尺寸150。 */
type PositionedUnit = Pick<CombatUnit, 'side' | 'row' | 'col'>

export const projectileFlightMs = (actor: PositionedUnit, target: PositionedUnit): number => {
  const position = (unit: PositionedUnit) => ({
    x: (unit.side === 'party' ? -1 : 1) * (780 - 160 * unit.col + 60 * unit.row),
    y: 40 + 170 * unit.row,
  })
  const from = position(actor)
  const to = position(target)
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return 0
  const ux = dx / distance
  const uy = dy / distance
  // 移动方向旋转的100方形与轴对齐150方形：三个分离轴首次全部重叠。
  const projectedRadius = 75 + 50 * (ux + uy)
  const travel = Math.max(0,
    distance - (50 + 75 * (ux + uy)),
    ux > 0 ? distance - projectedRadius / ux : 0,
    uy > 0 ? distance - projectedRadius / uy : 0,
  )
  return travel / 2
}
