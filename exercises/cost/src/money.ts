export function money(value: number) {
  if (value === 0) return '$0'
  if (value < 0.0001) return `$${value.toFixed(7)}`
  return `$${value.toFixed(4)}`
}

export function perMillion(value: number | null) {
  if (value === null) return '—'
  return `$${(value * 1_000_000).toFixed(2)}/M`
}

export function cost(tokens: number | null, rate: number | null) {
  if (tokens === null || rate === null) return '—'
  return money(tokens * rate)
}
