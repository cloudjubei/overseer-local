import { describe, expect, it } from 'vitest'
import { getChatContext } from './chatKey'
import { assistantPath } from './assistantPath'

describe('assistantPath', () => {
  it('is the Assistant page without a conversation', () => {
    expect(assistantPath()).toBe('/assistant')
  })

  it('opens a conversation by its encoded chat key, which reads back to the same context', () => {
    const context = { type: 'GENERAL' as const, timestamp: '1760000000000' }
    const path = assistantPath(context)
    expect(path).toBe('/assistant/%2Fgeneral_1760000000000')
    expect(getChatContext(decodeURIComponent(path.slice('/assistant/'.length)))).toMatchObject(
      context,
    )
  })
})
