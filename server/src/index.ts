import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initDb, seedDb } from './db/sqlite.js';
import { initRealtime } from './realtime.js';
import { apiRouter } from './routes/api.js';

initDb();
seedDb();
const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'familyone', now: new Date().toISOString() });
});

app.use('/api', apiRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const server = createServer(app);
server.listen(PORT, () => {
  initRealtime(server);
  console.log(`[familyone] API listening on http://localhost:${PORT}`);
});