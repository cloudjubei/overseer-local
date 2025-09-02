import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import fss from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { ensureDirExists, ensureFileExists, findRootDir, joinAndNormalize, toPosix } from './path'

describe('utils/path', () => {
  it('ensures dir and file existence and formats', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'path-'))
    const dir = path.join(tmp, 'a')
    const file = path.join(dir, 'f.txt')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(file, 'x')

    expect(() => ensureDirExists(dir, 'dir')).not.toThrow()
    expect(() => ensureFileExists(file, 'file')).not.toThrow()
    expect(toPosix(path.join('a', 'b'))).toBe('a/b')
    expect(joinAndNormalize(tmp, '..').startsWith(path.parse(tmp).root)).toBe(true)
  })

  it('throws for non-existent dir/file', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'path-'))
    expect(() => ensureDirExists(path.join(tmp, 'nope'), 'dir')).toThrow()
    expect(() => ensureFileExists(path.join(tmp, 'nope.txt'), 'file')).toThrow()
  })

  it('finds root dir via env FACTORY_ROOT or projects upwards', async () => {
    const prev = process.env.FACTORY_ROOT
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'root-'))
    process.env.FACTORY_ROOT = tmp
    expect(findRootDir(path.join(tmp, 'x', 'y'))).toBe(path.resolve(tmp))

    // unset env: should discover projects dir upwards
    process.env.FACTORY_ROOT = ''
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'work-'))
    const child = path.join(workspace, 'a', 'b', 'c')
    await fs.mkdir(path.join(workspace, 'projects'), { recursive: true })
    await fs.mkdir(child, { recursive: true })
    expect(findRootDir(child)).toBe(path.resolve(workspace))

    process.env.FACTORY_ROOT = prev
  })
})
