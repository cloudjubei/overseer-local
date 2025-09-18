import { describe, it, expect, vi, beforeEach } from 'vitest'

const fakeBot = () => {
  return {
    sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
    sendChatAction: vi.fn().mockResolvedValue(undefined),
    editMessageReplyMarkup: vi.fn().mockResolvedValue(undefined),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
  } as any
}

describe('newGoal flow', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('fetches suggestions and shows them, allows refine and cancel', async () => {
    const bot = fakeBot()
    const { startNewGoalFlow, handleNewGoalFlowMessage, handleNewGoalCallback } = await import(
      '../src/flows/newGoal'
    )
    const { GoalsService } = await import('../src/generated/backend')

    ;(GoalsService.goalsControllerAiSuggestions as any).mockResolvedValue({
      suggestions: [
        { text: 'Walk 10 minutes', type: 'MICRO', category: 'FITNESS', difficulty: 'EASY' },
      ],
      understoodText: 'walk',
      message: 'ok',
    })

    const userId = 'u1'
    const chatId = 1
    await startNewGoalFlow(bot, userId, chatId)

    // Provide text
    await handleNewGoalFlowMessage(bot, userId, { chat: { id: chatId }, text: 'I want to walk' } as any)

    // Refine
    await handleNewGoalCallback(bot, userId, {
      id: 'cb1',
      data: 'goals:refine',
      from: { id: Number(userId) } as any,
    } as any)

    // Cancel
    const handled = await handleNewGoalCallback(bot, userId, {
      id: 'cb2',
      data: 'goals:cancel',
      from: { id: Number(userId) } as any,
    } as any)

    expect(handled).toBe(true)
  })

  it('creates a goal when a suggestion is picked', async () => {
    const bot = fakeBot()
    const { startNewGoalFlow, handleNewGoalFlowMessage, handleNewGoalCallback } = await import(
      '../src/flows/newGoal'
    )
    const { GoalsService } = await import('../src/generated/backend')

    ;(GoalsService.goalsControllerAiSuggestions as any).mockResolvedValue({
      suggestions: [
        { text: 'Run 1 km', type: 'MICRO', category: 'FITNESS', difficulty: 'MEDIUM' },
      ],
    })

    ;(GoalsService.goalsControllerCreate as any).mockResolvedValue({
      text: 'Run 1 km',
      type: 'MICRO',
      category: 'FITNESS',
      difficulty: 'MEDIUM',
    })

    const userId = 'u2'
    const chatId = 2
    await startNewGoalFlow(bot, userId, chatId)

    await handleNewGoalFlowMessage(bot, userId, { chat: { id: chatId }, text: 'run' } as any)

    const handled = await handleNewGoalCallback(
      bot,
      userId,
      { id: 'cb3', data: 'goals:pick:0', from: { id: Number(userId) } } as any,
    )

    expect(handled).toBe(true)
    expect(GoalsService.goalsControllerCreate).toHaveBeenCalled()
  })
})
