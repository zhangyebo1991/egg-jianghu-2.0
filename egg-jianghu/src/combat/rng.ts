export interface Rng {
  nextFloat(): number
  nextInt(minInclusive: number, maxExclusive: number): number
  pick<T>(values: readonly T[]): T
}

export const normalizeSeed = (seed: number): number => {
  const normalized = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 1
  return normalized || 1
}

export const createRng = (seed: number): Rng => {
  let state = normalizeSeed(seed)
  return {
    nextFloat(): number {
      state = (state + 0x6D2B79F5) >>> 0
      let value = state
      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
    },
    nextInt(minInclusive: number, maxExclusive: number): number {
      const min = Math.ceil(minInclusive)
      const max = Math.floor(maxExclusive)
      if (max <= min) throw new Error('随机整数范围无效')
      return min + Math.floor(this.nextFloat() * (max - min))
    },
    pick<T>(values: readonly T[]): T {
      if (values.length === 0) throw new Error('不能从空集合中抽取')
      return values[this.nextInt(0, values.length)]
    },
  }
}
