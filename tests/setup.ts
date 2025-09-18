import fs from 'fs'
import os from 'os'
import path from 'path'

// Ensure required envs for config before modules import them
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'TEST_BOT_TOKEN'
process.env.BACKEND_SHARED_SECRET = process.env.BACKEND_SHARED_SECRET || 'TEST_SECRET'
process.env.BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:3000'
process.env.NODE_ENV = 'test'

// Create a unique session directory per test run
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'compass-sessions-'))
process.env.SESSIONS_DIR = tmp

// Mock generated backend modules to avoid real network
vi.mock('../src/generated/backend', () => {
  return {
    AuthService: {
      authControllerLoginTelegram: vi.fn(),
    },
    GoalsService: {
      goalsControllerList: vi.fn(),
      goalsControllerAiSuggestions: vi.fn(),
      goalsControllerCreate: vi.fn(),
    },
    ProfilesService: {
      profilesControllerUpdate: vi.fn(),
      profilesControllerCreate: vi.fn(),
    },
  }
})

vi.mock('../src/generated/backend/services/CheckInsService', () => {
  return {
    CheckInsService: {
      checkInsControllerGetCheckIns: vi.fn(),
    },
  }
})
