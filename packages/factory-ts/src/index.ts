export * as events from './events';
export * as electronShim from './adapters/electronShim';
// Existing exports
export * from './errors/types';
export * from './errors/redact';
export * from './files';
export * from './git';
export * from './db/store';
export * as artifacts from './artifacts';
export * from './config';
export * from './orchestrator';

// Minimal factory API to satisfy existing tests
export class OverseerFactory {
  constructor(public options: { version: string }) {}
  hello(name: string): string {
    return `Hello, ${name} from OverseerFactory v${this.options.version}`;
  }
}

export function createFactory(options: { version: string }): OverseerFactory {
  return new OverseerFactory(options);
}
