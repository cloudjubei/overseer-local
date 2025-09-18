import fs from 'fs';
import path from 'path';

export interface UserSession {
  userId: string; // Telegram user id as string
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresAt?: number; // epoch seconds
}

const DATA_DIR = path.resolve('.factory');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAll(): Record<string, UserSession> {
  try {
    ensureDataDir();
    if (!fs.existsSync(SESSIONS_FILE)) return {};
    const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
    if (!raw.trim()) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? (data as Record<string, UserSession>) : {};
  } catch (e) {
    console.warn('sessionStore: failed to read sessions file, starting empty', e);
    return {};
  }
}

function writeAll(sessions: Record<string, UserSession>) {
  try {
    ensureDataDir();
    const tmp = SESSIONS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(sessions, null, 2), 'utf8');
    fs.renameSync(tmp, SESSIONS_FILE);
  } catch (e) {
    console.error('sessionStore: failed to write sessions file', e);
  }
}

export function getSession(userId: string): UserSession | undefined {
  const all = readAll();
  return all[userId];
}

export function setSession(session: UserSession) {
  const all = readAll();
  all[session.userId] = session;
  writeAll(all);
}

export function clearSession(userId: string) {
  const all = readAll();
  if (all[userId]) {
    delete all[userId];
    writeAll(all);
  }
}

export function isAuthenticated(userId: string): boolean {
  const s = getSession(userId);
  if (!s || !s.accessToken) return false;
  if (s.expiresAt && Number.isFinite(s.expiresAt)) {
    const now = Math.floor(Date.now() / 1000);
    return now < s.expiresAt - 30; // small skew
  }
  return true;
}
