// Simple environment-aware logger
// - In production/development: logs as usual
// - In test: suppresses warn/error by default to keep test output clean
// Override with LOG_LEVEL if needed: 'silent' | 'error' | 'warn' | 'info' | 'debug'

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'

function getLevel(): LogLevel {
  const env = process.env.NODE_ENV || 'development'
  const explicit = (process.env.LOG_LEVEL || '').toLowerCase() as LogLevel
  if (explicit) return explicit
  // Default per env
  if (env === 'test') return 'info' // show info/debug only if explicitly enabled
  return 'info'
}

const levelOrder: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
}

const currentLevel = getLevel()

function shouldLog(lvl: LogLevel): boolean {
  // In test environment, suppress warn/error by default unless LOG_LEVEL forces them
  if ((process.env.NODE_ENV || 'development') === 'test' && !process.env.LOG_LEVEL) {
    if (lvl === 'error' || lvl === 'warn') return false
  }
  return levelOrder[lvl] <= levelOrder[currentLevel]
}

export const logger = {
  error: (...args: any[]) => {
    if (shouldLog('error')) console.error(...args)
  },
  warn: (...args: any[]) => {
    if (shouldLog('warn')) console.warn(...args)
  },
  info: (...args: any[]) => {
    if (shouldLog('info')) console.log(...args)
  },
  debug: (...args: any[]) => {
    if (shouldLog('debug')) console.debug(...args)
  },
}

export default logger
