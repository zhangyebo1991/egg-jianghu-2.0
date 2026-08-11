import type { EvidenceStatus } from '../data/research'

/** 证据状态的中文标签。属性条目与机制观察共用同一张表。 */
export const STATUS_LABEL: Record<EvidenceStatus, string> = {
  confirmed: '已确认',
  reference: '资料参考',
  inference: '研究推论',
  todo: '待实机核验',
}

/** 统一的两位数字编号，如 01、07、53。 */
export function padCount(value: number): string {
  return value.toString().padStart(2, '0')
}
