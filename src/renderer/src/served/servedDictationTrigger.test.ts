import { describe, expect, it } from 'vitest'
import { SERVED_DICTATION_UNAVAILABLE } from './servedConstants'
import { macOsDictationTrigger } from './servedDictationTrigger'

describe('the served build dictation trigger', () => {
  it('keeps the mic button the desktop composer shows', () => {
    expect(macOsDictationTrigger.isSupported()).toBe(true)
  })

  it('says plainly that dictation needs the desktop app', async () => {
    await expect(macOsDictationTrigger.trigger()).resolves.toEqual({
      status: 'unavailable',
      reason: SERVED_DICTATION_UNAVAILABLE,
    })
  })
})
