import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const configPath = resolve(__dirname, 'electron-builder.cjs')
const require = createRequire(configPath)
const signingKeys = ['CSC_LINK', 'CSC_NAME'] as const
const savedEnv = Object.fromEntries(signingKeys.map((key) => [key, process.env[key]]))

type BuilderConfig = {
  appId: string
  productName: string
  extraMetadata: { name: string; productName: string }
  files: string[]
  mac: Record<string, unknown>
  win: Record<string, unknown>
  linux: Record<string, unknown>
}

const loadConfig = (env: Partial<Record<(typeof signingKeys)[number], string>>): BuilderConfig => {
  for (const key of signingKeys) {
    if (env[key] === undefined) delete process.env[key]
    else process.env[key] = env[key]
  }
  delete require.cache[configPath]
  return require(configPath) as BuilderConfig
}

afterEach(() => {
  for (const key of signingKeys) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
  delete require.cache[configPath]
})

describe('electron-builder config', () => {
  it('turns macOS signing off when no signing env is set', () => {
    const config = loadConfig({})
    expect(config.mac).toHaveProperty('identity', null)
  })

  it.each([
    [{ CSC_LINK: 'base64:abc' }],
    [{ CSC_NAME: 'Example Team (ABCDE12345)' }],
    [{ CSC_LINK: 'file:///certs/id.p12', CSC_NAME: 'Example Team (ABCDE12345)' }],
  ])('leaves identity to electron-builder when signing env is set: %o', (env) => {
    const config = loadConfig(env)
    expect(config.mac).not.toHaveProperty('identity')
  })

  it('treats an empty signing env value as not set', () => {
    const config = loadConfig({ CSC_LINK: '', CSC_NAME: '' })
    expect(config.mac).toHaveProperty('identity', null)
  })

  it('never lets keychain discovery fall back to a development identity', () => {
    expect(loadConfig({}).mac.type).toBe('distribution')
    expect(loadConfig({ CSC_LINK: 'base64:abc' }).mac.type).toBe('distribution')
  })

  it('gives the packaged app its own identity and data folder name', () => {
    const config = loadConfig({})
    expect(config.appId).toBe('com.thefactory.overseer.desktop')
    expect(config.productName).toBe('Overseer')
    expect(config.extraMetadata.productName).toBe(config.productName)
    expect(config.extraMetadata.name).toBe('overseer')
  })

  it('ships the runtime icon and points every platform at its generated icon', () => {
    const config = loadConfig({})
    expect(config.files).toContain('resources/**')
    expect(config.mac.icon).toBe('build/icon.icns')
    expect(config.win.icon).toBe('build/icon.ico')
    expect(config.linux.icon).toBe('build/icon.png')
  })
})
