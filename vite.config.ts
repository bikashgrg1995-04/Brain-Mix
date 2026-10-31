import { renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { parseQuestFile, serializeQuests } from './shared/quests';

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

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const MAX_BODY = 1_000_000;

/**
 * DEV matra (`apply: 'serve'`, build ma jaandaina): admin.html ko "Save to project" le yaha POST garchha
 * ra src/content/quests.json lekhchha. Kunai web page le laptop ko file nabadlos bhanera:
 * localhost matra, Origin same hunuparchha, ra `X-Admin` header chahinchha. Content validate garera matra lekhchha.
 */
function questSave(): Plugin {
  return {
    name: 'quest-save',
    apply: 'serve',
    configureServer(server) {
      const target = resolve(server.config.root, 'src/content/quests.json');
      server.middlewares.use('/__admin/save', (req, res) => {
        const reply = (code: number, message: string): void => {
          res.statusCode = code;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: code === 200, message }));
        };
        const host = String(req.headers.host ?? '');
        if (req.method !== 'POST') return reply(405, 'POST matra');
        if (!LOCAL_HOST.test(host)) return reply(403, 'localhost matra');
        if (req.headers.origin && req.headers.origin !== `http://${host}`) return reply(403, 'Origin milena');
        if (req.headers['x-admin'] !== '1') return reply(403, 'X-Admin header chahinchha');

        let size = 0;
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => {
          size += c.length;
          if (size > MAX_BODY) {
            reply(413, 'File dherai thulo');
            req.destroy();
            return;
          }
          chunks.push(c);
        });
        req.on('end', () => {
          const { file, errors } = parseQuestFile(Buffer.concat(chunks).toString('utf8'));
          if (errors.length > 0) return reply(400, errors.slice(0, 5).join(' | '));
          const tmp = `${target}.tmp`;
          writeFileSync(tmp, serializeQuests(file));
          renameSync(tmp, target); // adha lekheko file kahile nabanos
          reply(200, `${Object.keys(file.quests).length} quest save bhayo`);
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './', // bundle ma relative paths chahinchha
  plugins: [fbSdk(mode), questSave()],
  build: { target: 'es2020', chunkSizeWarningLimit: 300 },
}));
