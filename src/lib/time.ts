export async function sleep(ms: number): Promise<void> {
  // Skip actual waiting during tests to keep the test suite fast
  if (process.env.NODE_ENV === 'test') return
  await new Promise((resolve) => setTimeout(resolve, ms))
}
