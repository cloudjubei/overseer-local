import { describe, expect, it } from 'vitest'
import { isStrayFileNavigation } from './navigationGuard'

const PROD_APP = 'file:///Applications/Overseer.app/Contents/Resources/app/out/renderer/index.html'
const DEV_APP = 'http://localhost:5173/'

describe('isStrayFileNavigation', () => {
  it('catches a file dropped on the window of the dev app', () => {
    expect(isStrayFileNavigation('file:///Users/me/Desktop/shot.png', DEV_APP)).toBe(true)
  })

  it('catches a file dropped on the window of the packaged app', () => {
    expect(isStrayFileNavigation('file:///Users/me/Desktop/notes.md', PROD_APP)).toBe(true)
  })

  it('lets the packaged app move within its own page', () => {
    expect(isStrayFileNavigation(`${PROD_APP}#/projects/p1/chat`, PROD_APP)).toBe(false)
    expect(isStrayFileNavigation(`${PROD_APP}?x=1`, `${PROD_APP}#/home`)).toBe(false)
  })

  it('leaves every other navigation to the existing handlers', () => {
    expect(isStrayFileNavigation('http://localhost:5173/projects', DEV_APP)).toBe(false)
    expect(isStrayFileNavigation('https://example.com/', PROD_APP)).toBe(false)
  })

  it('treats an unreadable target as no file navigation', () => {
    expect(isStrayFileNavigation('not a url', DEV_APP)).toBe(false)
  })
})
