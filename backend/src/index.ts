import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from './app.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFiles() {
  const candidates = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../frontend/.env'),
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      if (val && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFiles();

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`NexCRM Backend API listening on http://localhost:${PORT}`);

  // Keep-alive heartbeat to prevent Render free-tier spin-down after 15 mins of inactivity
  const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_API_URL;
  if (externalUrl) {
    const healthUrl = `${externalUrl.replace(/\/+$/, '')}/api/health`;
    setInterval(() => {
      fetch(healthUrl).catch(() => {});
    }, 10 * 60 * 1000);
  }
});
