import { describe, it, expect, beforeEach, afterEach } from 'vitest'
// Import as namespace to get access to named exports and default
import * as gitHelper from '../src/logic/git-monitor/gitHelper.js'

let calls: Array<{ cmd: string; args: string[]; options: any }> = []

beforeEach(() => {
  calls = []
  // Override exec implementation
  gitHelper.__setExecImplForTests(async (cmd: string, args: string[], options: any) => {
    calls.push({ cmd, args, options })
    const joined = args.join(' ')
    if (joined.includes('--left-right --count')) {
      return { stdout: '2 5', stderr: '' }
    }
    if (cmd === 'git' && args[0] === 'diff' && args[1] === '--name-status') {
      return {
        stdout: 'M src/index.ts\nA docs/readme.md\nD file with spaces.txt',
        stderr: '',
      }
    }
    return { stdout: '', stderr: '' }
  })
})

afterEach(() => {
  // reset mock by setting a passthrough impl
  gitHelper.__setExecImplForTests(async (_cmd: string, _args: string[], _options: any) => {
    return { stdout: '', stderr: '' }
  })
})

describe('gitHelper.getAheadBehind', () => {
  it('parses ahead/behind counts from git rev-list output', async () => {
    const res: any = await gitHelper.getAheadBehind('/repo', 'feature/branch', 'main')
    expect(res.ok).toBe(true)
    expect(res.ahead).toBe(5)
    expect(res.behind).toBe(2)
    expect(res.base).toBe('main')
    expect(res.branch).toBe('feature/branch')
    // Ensure correct git command invocation
    const last = calls[calls.length - 1]
    expect(last.cmd).toBe('git')
    expect(last.args.slice(0, 3)).toEqual(['rev-list', '--left-right', '--count'])
  })

  it('handles empty stdout gracefully', async () => {
    // Rewire to return empty stdout
    gitHelper.__setExecImplForTests(async (cmd: string, args: string[], options: any) => {
      calls.push({ cmd, args, options })
      return { stdout: '', stderr: '' }
    })
    const res: any = await gitHelper.getAheadBehind('/repo', 'b', 'a')
    expect(res.ok).toBe(true)
    expect(res.ahead).toBe(0)
    expect(res.behind).toBe(0)
  })
})

describe('gitHelper.getDiffFilesBetween', () => {
  it('parses name-status into array of files with status', async () => {
    const res: any = await gitHelper.getDiffFilesBetween('/repo', 'main', 'feature')
    expect(res.ok).toBe(true)
    // Should include 3 entries
    expect(res.files.length).toBe(3)
    expect(res.files[0]).toEqual({ path: 'src/index.ts', status: 'M' })
    expect(res.files[1]).toEqual({ path: 'docs/readme.md', status: 'A' })
    expect(res.files[2]).toEqual({ path: 'file with spaces.txt', status: 'D' })
  })
})
