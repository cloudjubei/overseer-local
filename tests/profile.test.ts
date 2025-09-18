import { describe, it, expect, vi, beforeEach } from 'vitest'

const fakeBot = () => {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendChatAction: vi.fn().mockResolvedValue(undefined),
  } as any
}

describe('profile flow', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('validates DOB format and proceeds through flow', async () => {
    const bot = fakeBot()
    const { startProfileFlow, handleProfileFlowMessage } = await import('../src/flows/profile')
    const { ProfilesService } = await import('../src/generated/backend')
    ;(ProfilesService.profilesControllerUpdate as any).mockResolvedValue({
      dob: '1990-01-02',
      gender: 'MALE',
      weight_raw: '80 kg',
      height_raw: '180 cm',
    })

    const userId = 'u1'
    const chatId = 123

    await startProfileFlow(bot, userId, chatId)
    // Invalid DOB
    await handleProfileFlowMessage(bot, userId, { chat: { id: chatId }, text: '01-01-1990' } as any)
    expect(bot.sendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('valid date in the format YYYY-MM-DD'),
    )

    // Valid DOB
    await handleProfileFlowMessage(bot, userId, { chat: { id: chatId }, text: '1990-01-02' } as any)

    // Gender
    await handleProfileFlowMessage(bot, userId, { chat: { id: chatId }, text: 'Male' } as any)

    // Weight
    await handleProfileFlowMessage(bot, userId, { chat: { id: chatId }, text: '80 kg' } as any)

    // Height triggers submit
    await handleProfileFlowMessage(bot, userId, { chat: { id: chatId }, text: '180 cm' } as any)

    expect(ProfilesService.profilesControllerUpdate).toHaveBeenCalled()
    expect(bot.sendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('Your profile has been updated.'),
    )
  })

  it('falls back to create on 404', async () => {
    const bot = fakeBot()
    const { startProfileFlow, handleProfileFlowMessage } = await import('../src/flows/profile')
    const { ProfilesService } = await import('../src/generated/backend')

    ;(ProfilesService.profilesControllerUpdate as any).mockRejectedValue({ status: 404 })
    ;(ProfilesService.profilesControllerCreate as any).mockResolvedValue({ gender: 'OTHER' })

    const userId = 'u2'
    const chatId = 456
    await startProfileFlow(bot, userId, chatId)

    await handleProfileFlowMessage(bot, userId, { chat: { id: chatId }, text: 'skip' } as any)
    await handleProfileFlowMessage(bot, userId, { chat: { id: chatId }, text: 'skip' } as any)
    await handleProfileFlowMessage(bot, userId, { chat: { id: chatId }, text: 'skip' } as any)
    await handleProfileFlowMessage(bot, userId, { chat: { id: chatId }, text: 'skip' } as any)

    expect(ProfilesService.profilesControllerCreate).toHaveBeenCalled()
  })

  it('handles error on submit gracefully', async () => {
    const bot = fakeBot()
    const { startProfileFlow, handleProfileFlowMessage } = await import('../src/flows/profile')
    const { ProfilesService } = await import('../src/generated/backend')

    ;(ProfilesService.profilesControllerUpdate as any).mockRejectedValue(new Error('oops'))

    const userId = 'u3'
    const chatId = 789
    await startProfileFlow(bot, userId, chatId)

    await handleProfileFlowMessage(bot, userId, { chat: { id: chatId }, text: 'skip' } as any)
    await handleProfileFlowMessage(bot, userId, { chat: { id: chatId }, text: 'Male' } as any)
    await handleProfileFlowMessage(bot, userId, { chat: { id: chatId }, text: '80 kg' } as any)
    await handleProfileFlowMessage(bot, userId, { chat: { id: chatId }, text: '180 cm' } as any)

    expect(bot.sendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('could not update your profile'),
    )
  })
})
