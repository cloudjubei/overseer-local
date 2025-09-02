/* Simple dev logger for factory-ts. Enabled when NODE_ENV=development or FACTORY_DEBUG=true. */

const getIsDev = () => {
  try {
    // process may not exist in some runtimes
    // @ts-ignore
    const env = typeof process !== 'undefined' ? process.env || {} : ({} as any);
    const nodeEnv = (env.NODE_ENV || '').toLowerCase();
    const flag = String(env.FACTORY_DEBUG || '').toLowerCase();
    return nodeEnv === 'development' || flag === '1' || flag === 'true';
  } catch {
    return false;
  }
};

let IS_DEV = getIsDev();

export function setFactoryDebug(enabled: boolean) {
  IS_DEV = !!enabled;
}

function stamp() {
  try {
    return new Date().toISOString();
  } catch {
    return '';
  }
}

export const logger = {
  isDev() {
    return IS_DEV;
  },
  debug(...args: any[]) {
    if (!IS_DEV) return;
    try {
      // eslint-disable-next-line no-console
      console.debug('[factory-ts]', stamp(), ...args);
    } catch {}
  },
  info(...args: any[]) {
    if (!IS_DEV) return;
    try {
      // eslint-disable-next-line no-console
      console.info('[factory-ts]', stamp(), ...args);
    } catch {}
  },
  warn(...args: any[]) {
    try {
      // eslint-disable-next-line no-console
      console.warn('[factory-ts]', stamp(), ...args);
    } catch {}
  },
  error(...args: any[]) {
    try {
      // eslint-disable-next-line no-console
      console.error('[factory-ts]', stamp(), ...args);
    } catch {}
  },
};
