import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: '../thefactory-backend/swagger/swagger.json',
  output: {
    path: './src/renderer/src/generated/backend',
  },
  plugins: ['@hey-api/client-axios', '@hey-api/typescript', '@hey-api/sdk'],
})
