export async function sleep(ms: number): Promise<void> {
  // Skip actual waiting during tests to keep the test suite fast
  if (process.env.NODE_ENV === 'test') return
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export function getDayOfYear(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}
