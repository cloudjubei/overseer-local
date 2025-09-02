# @overseer/factory

TypeScript library for Overseer to manage AI agents that execute project tasks/features. 

Features (initial scaffold):
- ESM + CJS outputs
- Type declarations
- tsup build
- vitest test runner
- eslint/prettier linting

Scripts:
- npm run build
- npm run test
- npm run dev
- npm run lint

Usage example:

```ts
import { createFactory } from '@overseer/factory';

const factory = createFactory({ version: '0.1.0' });
console.log(factory.hello('Overseer'));
```
