import { describe, expect, it, vi } from 'vitest'
import { DeepLinkInbox } from './deepLinkInbox'

const STORY = 'overseer://projects/p1/stories/s1'
const RUN = 'overseer://projects/p1/process-runs/r1'

describe('DeepLinkInbox', () => {
  it('holds a link that arrives before the app listens and hands it over once it does', () => {
    const deliver = vi.fn()
    const inbox = new DeepLinkInbox(deliver)
    inbox.receive(STORY)
    expect(deliver).not.toHaveBeenCalled()
    inbox.setListening(true)
    expect(deliver).toHaveBeenCalledExactlyOnceWith(STORY)
  })

  it('hands a link straight over while the app listens', () => {
    const deliver = vi.fn()
    const inbox = new DeepLinkInbox(deliver)
    inbox.setListening(true)
    inbox.receive(STORY)
    expect(deliver).toHaveBeenCalledExactlyOnceWith(STORY)
  })

  it('keeps only the latest of several held links', () => {
    const deliver = vi.fn()
    const inbox = new DeepLinkInbox(deliver)
    inbox.receive(STORY)
    inbox.receive(RUN)
    inbox.setListening(true)
    expect(deliver).toHaveBeenCalledExactlyOnceWith(RUN)
  })

  it('hands a held link over only once', () => {
    const deliver = vi.fn()
    const inbox = new DeepLinkInbox(deliver)
    inbox.receive(STORY)
    inbox.setListening(true)
    inbox.setListening(true)
    inbox.setListening(false)
    inbox.setListening(true)
    expect(deliver).toHaveBeenCalledTimes(1)
  })

  it('holds links again once the app stops listening, as on a reload', () => {
    const deliver = vi.fn()
    const inbox = new DeepLinkInbox(deliver)
    inbox.setListening(true)
    inbox.setListening(false)
    inbox.receive(RUN)
    expect(deliver).not.toHaveBeenCalled()
    inbox.setListening(true)
    expect(deliver).toHaveBeenCalledExactlyOnceWith(RUN)
  })

  it('survives a listen, stop, listen burst as a remount makes, handing the link over once', () => {
    const deliver = vi.fn()
    const inbox = new DeepLinkInbox(deliver)
    inbox.receive(STORY)
    inbox.setListening(true)
    inbox.setListening(false)
    inbox.setListening(true)
    inbox.receive(RUN)
    expect(deliver.mock.calls).toEqual([[STORY], [RUN]])
  })
})
