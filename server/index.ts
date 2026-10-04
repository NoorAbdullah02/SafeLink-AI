import { createApp } from './app.js';
import { createStore } from './store.js';
import { config } from './config.js';
const store = createStore();
const app = createApp(store);
app.listen(config.port, '0.0.0.0', (error?: Error) => {
  if (error) {
    console.error('SafeLink API failed to start: ' + error.message);
    process.exitCode = 1;
    return;
  }
  console.log(
    `SafeLink API http://localhost:${config.port} · ${store.memory ? 'TEMPORARY DEMO STORAGE' : 'PostgreSQL'}`,
  );
});
async function cleanup() {
  try {
    const cutoff = Date.now() - config.retentionDays * 86400000;
    for (const row of await store.list('scans'))
      if (!row.saved && +new Date(row.createdAt) < cutoff) await store.remove('scans', row.id);
    for (const table of ['sessions', 'authTokens'] as const)
      for (const row of await store.list(table))
        if (+new Date(row.expiresAt) < Date.now()) await store.remove(table, row.id);
  } catch {
    console.warn('Retention cleanup unavailable; will retry.');
  }
}
void cleanup();
setInterval(cleanup, 3600000).unref();
