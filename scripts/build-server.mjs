// server/game.ts (+ shared/ ra src/ ko niyam) lai ek file ma bundle: Deno ma extension/alias ko jhanjhat nahune.
import { build } from 'esbuild';

await build({
  entryPoints: ['server/game.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  loader: { '.json': 'json' },
  outfile: 'supabase/functions/game/game.js',
  logLevel: 'info',
});
