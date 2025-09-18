import TelegramBot from 'node-telegram-bot-api'
import { ProfilesService, UserProfileDto } from '../generated/backend'

export type Gender = 'MALE' | 'FEMALE' | 'OTHER'

type Step = 'ask_dob' | 'ask_gender' | 'ask_weight' | 'ask_height' | 'submitting'

interface ProfileFlowData {
  dob?: string
  gender?: Gender
  weight_raw?: string
  height_raw?: string
}

interface ProfileFlowState {
  step: Step
  data: ProfileFlowData
  chatId: number
}

const flows = new Map<string, ProfileFlowState>() // key: userId

export function isInProfileFlow(userId: string): boolean {
  return flows.has(userId)
}

export async function startProfileFlow(bot: TelegramBot, userId: string, chatId: number) {
  flows.set(userId, { step: 'ask_dob', data: {}, chatId })
  await bot.sendMessage(
    chatId,
    [
      "Let's update your profile. I'll ask a few questions. You can /cancel anytime.",
      '',
      '1) What is your date of birth? Please use YYYY-MM-DD (e.g., 1990-01-01).',
      'If you prefer not to set this now, reply with skip.',
    ].join('\n'),
  )
}

export async function cancelProfileFlow(bot: TelegramBot, userId: string) {
  const state = flows.get(userId)
  if (state) {
    flows.delete(userId)
    await bot.sendMessage(state.chatId, 'Profile update cancelled.')
  }
}

function normalizeGenderInput(text: string): Gender | undefined {
  const t = text.trim().toLowerCase()
  if (t === 'male' || t === 'm') return 'MALE'
  if (t === 'female' || t === 'f') return 'FEMALE'
  if (t === 'other' || t === 'o' || t === 'non-binary' || t === 'nonbinary' || t === 'nb')
    return 'OTHER'
  return undefined
}

export async function handleProfileFlowMessage(
  bot: TelegramBot,
  userId: string,
  msg: TelegramBot.Message,
) {
  const state = flows.get(userId)
  if (!state) return // not our flow

  const chatId = state.chatId
  const text = (msg.text || '').trim()

  // Handle cancel
  if (/^\/(cancel)(@\w+)?$/i.test(text)) {
    await cancelProfileFlow(bot, userId)
    return
  }

  // Handle skip keyword for optional fields
  const skipped = /^skip$/i.test(text)

  switch (state.step) {
    case 'ask_dob': {
      if (!skipped && text.length > 0 && !text.startsWith('/')) {
        state.data.dob = text // backend validates format
      }
      state.step = 'ask_gender'
      flows.set(userId, state)
      await bot.sendMessage(chatId, '2) What is your gender?', {
        reply_markup: {
          keyboard: [[{ text: 'Male' }, { text: 'Female' }, { text: 'Other' }], [{ text: 'skip' }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      })
      break
    }
    case 'ask_gender': {
      if (!skipped && text.length > 0 && !text.startsWith('/')) {
        const g = normalizeGenderInput(text)
        if (g) {
          state.data.gender = g
        } else {
          // Prompt again with buttons if unrecognized
          await bot.sendMessage(
            chatId,
            'Please choose one of: Male, Female, Other. Or reply with skip.',
            {
              reply_markup: {
                keyboard: [
                  [{ text: 'Male' }, { text: 'Female' }, { text: 'Other' }],
                  [{ text: 'skip' }],
                ],
                resize_keyboard: true,
                one_time_keyboard: true,
              },
            },
          )
          return
        }
      }
      state.step = 'ask_weight'
      flows.set(userId, state)
      await bot.sendMessage(
        chatId,
        [
          '3) What is your weight? You can answer freely (e.g., "82 kg", "180 lb", "11st 4lb").',
          'Or reply with skip.',
        ].join('\n'),
        { reply_markup: { remove_keyboard: true } },
      )
      break
    }
    case 'ask_weight': {
      if (!skipped && text.length > 0 && !text.startsWith('/')) {
        state.data.weight_raw = text
      }
      state.step = 'ask_height'
      flows.set(userId, state)
      await bot.sendMessage(
        chatId,
        [
          '4) What is your height? You can answer freely (e.g., "175 cm", "1.75 m", "5\'11\"", "71 in").',
          'Or reply with skip.',
        ].join('\n'),
      )
      break
    }
    case 'ask_height': {
      if (!skipped && text.length > 0 && !text.startsWith('/')) {
        state.data.height_raw = text
      }
      // Submit to backend
      state.step = 'submitting'
      flows.set(userId, state)
      await bot.sendChatAction(chatId, 'typing')
      try {
        const payload: any = {}
        if (state.data.dob) payload.dob = state.data.dob
        if (state.data.gender) payload.gender = state.data.gender
        if (state.data.weight_raw) payload.weight_raw = state.data.weight_raw
        if (state.data.height_raw) payload.height_raw = state.data.height_raw

        let result : UserProfileDto
        try {
          result = await ProfilesService.profilesControllerUpdate({ requestBody: payload })
        } catch (err: any) {
          // If update fails due to missing profile, try create
          const status = err?.status || err?.response?.status
          if (status === 404) {
            result = await ProfilesService.profilesControllerCreate({ requestBody: payload })
          } else {
            throw err
          }
        }

        flows.delete(userId)

        const lines: string[] = ['Your profile has been updated.']
        if (result) {
          const parts: string[] = []
          if (typeof result.dob === 'string') parts.push(`DOB: ${result.dob}`)
          if (typeof result.gender === 'string') parts.push(`Gender: ${result.gender}`)
          const weightPart = result.weight
            ? `${result.weight} kg`
            : result.weight_raw
              ? `${result.weight_raw}`
              : undefined
          if (weightPart) parts.push(`Weight: ${weightPart}`)
          const heightPart = result.height
            ? `${result.height} cm`
            : result.height_raw
              ? `${result.height_raw}`
              : undefined
          if (heightPart) parts.push(`Height: ${heightPart}`)
          if (parts.length) lines.push(parts.join('\n'))
        }
        await bot.sendMessage(chatId, lines.join('\n'))
      } catch (err: any) {
        console.error('Failed to update profile', err?.response?.data || err?.message || err)
        flows.delete(userId)
        await bot.sendMessage(
          chatId,
          'Sorry, I could not update your profile. Please try again later or ensure your inputs are valid.',
        )
      }
      break
    }
    case 'submitting':
    default:
      // Ignore extra messages while submitting
      break
  }
}
