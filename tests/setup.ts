import { vi } from 'vitest'
import path from 'path'
import fs from 'fs'

// Mock the generated backend services
vi.mock('../src/generated/backend', () => ({
  AuthService: {
    authControllerLoginTelegram: vi.fn(),
  },
  GoalsService: {
    goalsControllerList: vi.fn(),
    goalsControllerCreate: vi.fn(),
  },
  CheckInsService: {
    checkInsControllerGetCheckIns: vi.fn(),
  },
  ConversationsService: {
    conversationsControllerStart: vi.fn(),
    conversationsControllerHandle: vi.fn(),
    conversationsControllerCancel: vi.fn(),
  },
}))

// Set up a consistent test environment
process.env.NODE_ENV = 'test'
process.env.TELEGRAM_BOT_TOKEN = 'test-telegram-token'
process.env.BACKEND_SHARED_SECRET = 'test-backend-secret'

// Create a temporary directory for session storage to isolate tests
const tempSessionsDir = path.join(__dirname, '../.temp_sessions')

// Clean up any previous session files before starting and create the directory
if (fs.existsSync(tempSessionsDir)) {
  fs.rmSync(tempSessionsDir, { recursive: true, force: true })
}
fs.mkdirSync(tempSessionsDir, { recursive: true })

process.env.SESSIONS_DIR = tempSessionsDir

// Clean up the temporary sessions directory after all tests are done
const cleanup = () => {
  if (fs.existsSync(tempSessionsDir)) {
    fs.rmSync(tempSessionsDir, { recursive: true, force: true })
  }
}

process.on('exit', cleanup)
