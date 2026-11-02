import { startTestRunTempDir } from 'thefactory-tools/test'

/**
 * Once per test run, before any worker starts: give the run a temp dir of its own, which the
 * returned teardown removes at the end, naming whatever the tests left in it.
 */
export default async function setup(): Promise<() => Promise<void>> {
  return startTestRunTempDir()
}
