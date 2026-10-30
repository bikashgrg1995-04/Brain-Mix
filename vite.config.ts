import { defineConfig, type Plugin } from 'vite';

// Facebook SDK sirf `--mode fb` build ma inject hunchha. Dev/mock build ma hudaina.
// SDK URL/version Meta ko current docs bata verify garnus (Zero Permissions ko lagi v8.0 chahinchha).
const FB_SDK = 'https://connect.facebook.net/en_US/fbinstant.8.0.js';

function fbSdk(mode: string): Plugin {
  return {
    name: 'fb-sdk',
    transformIndexHtml(html) {
      const tag = mode === 'fb' ? `<script src="${FB_SDK}"></script>` : '';
      return html.replace('<!--FB_SDK-->', tag);
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './', // bundle ma relative paths chahinchha
  plugins: [fbSdk(mode)],
  build: { target: 'es2020', chunkSizeWarningLimit: 300 },
}));
