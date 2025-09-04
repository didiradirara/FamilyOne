import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import cors from 'cors';
import { createServer } from 'http';
import { initDb, seedDb, sqlite } from './db/sqlite.js';
import { initRealtime } from './realtime.js';
import { apiRouter } from './routes/api.js';
import { authRouter } from './routes/auth.js';

initDb();
seedDb();
const app = express();
app.use(cors());
// Increase JSON body limit to allow base64 image uploads
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '15mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'familyone', now: new Date().toISOString() });
});

// Static uploads
const uploadsDir = path.resolve(process.cwd(), 'server/uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}
app.use('/uploads', express.static(uploadsDir));

app.use('/auth', authRouter);
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

// Logs dir for maintenance
const logsDir = path.resolve(process.cwd(), 'server/logs');
try { fs.mkdirSync(logsDir, { recursive: true }); } catch {}
function maintLog(line: string) {
  try { fs.appendFileSync(path.join(logsDir, 'uploads-maintenance.log'), `[${new Date().toISOString()}] ${line}\n`); } catch {}
}

// Expired file cleanup: remove files in uploads not referenced by reports and older than TTL days
const TTL_DAYS = Number(process.env.UPLOAD_TTL_DAYS || 30);
function cleanupUploads() {
  try {
    const uploads = fs.readdirSync(uploadsDir).filter(n => /^[a-zA-Z0-9_.-]+$/.test(n));
    // collect used upload names from reports.imagesJson
    const rows = sqlite.prepare('SELECT imagesJson FROM reports').all() as any[];
    const used = new Set<string>();
    for (const r of rows) {
      if (!r?.imagesJson) continue;
      try {
        const arr: string[] = JSON.parse(r.imagesJson);
        for (const u of arr) {
          if (typeof u === 'string' && u.startsWith('/uploads/')) {
            const name = u.slice('/uploads/'.length);
            if (/^[a-zA-Z0-9_.-]+$/.test(name)) used.add(name);
          }
        }
      } catch {}
    }
    const now = Date.now();
    const ttlMs = TTL_DAYS * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const name of uploads) {
      if (used.has(name)) continue;
      const fp = path.join(uploadsDir, name);
      try {
        const st = fs.statSync(fp);
        if (now - st.mtimeMs > ttlMs) {
          try { fs.unlinkSync(fp); removed++; maintLog(`CLEAN OK ${name}`); } catch (e) { maintLog(`CLEAN FAIL ${name} ${(e as any)?.message || ''}`); }
        }
      } catch {}
    }
    maintLog(`CLEAN SUMMARY removed=${removed} ttlDays=${TTL_DAYS}`);
  } catch (e) {
    maintLog(`CLEAN ERROR ${(e as any)?.message || ''}`);
  }
}

// Run daily and once on boot after delay
setInterval(cleanupUploads, 24 * 60 * 60 * 1000);
setTimeout(cleanupUploads, 10_000);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const HOST = process.env.HOST || '127.0.0.1';
const server = createServer(app);
server.listen(PORT, HOST, () => {
  initRealtime(server);
  console.log(`[familyone] API listening on http://${HOST}:${PORT}`);
});
