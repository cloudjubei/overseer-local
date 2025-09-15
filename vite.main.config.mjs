import { defineConfig } from 'vite'
import commonjs from '@rollup/plugin-commonjs'

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['pg', '@xenova/transformers'],
      plugins: [
        commonjs({
          dynamicRequireTargets: [
            // Include onnxruntime-node as a dynamic import target
            'node_modules/onnxruntime-node/bin/**/*.node',
          ],
        }),
      ],
    },
  },
  assetsInclude: ['**/*.md'],
})
