import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// Resolve DB path relative to project (server/dev.db by default)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDbPath = path.resolve(__dirname, '../../dev.db');
const dbPath = process.env.SQLITE_DB_PATH || defaultDbPath;
export const sqlite = new Database(dbPath);
export function initDb() {
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('synchronous = NORMAL');
    const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('worker','manager','admin'))
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('machine_fault','material_shortage','defect','other')),
  message TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new','ack','resolved'))
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('mold_change','material_add','maintenance','other')),
  details TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending','approved','rejected')),
  reviewerId TEXT,
  reviewedAt TEXT
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  readBy TEXT NOT NULL -- JSON array of userIds
);

CREATE TABLE IF NOT EXISTS checklist_templates (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('safety','quality')),
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checklist_submissions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  userId TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('safety','quality')),
  itemsJson TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  anonymous INTEGER NOT NULL,
  createdBy TEXT
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  reason TEXT,
  state TEXT NOT NULL CHECK (state IN ('pending','approved','rejected')),
  reviewerId TEXT,
  reviewedAt TEXT
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  userId TEXT NOT NULL,
  shift TEXT NOT NULL
);
`;
    sqlite.exec(schema);
}
export function seedDb() {
    const countUsers = sqlite.prepare('SELECT COUNT(*) as c FROM users').get();
    const runUsers = () => {
        const insert = sqlite.prepare('INSERT INTO users (id,name,role) VALUES (?,?,?)');
        insert.run(randomUUID(), '작업자A', 'worker');
        insert.run(randomUUID(), '매니저B', 'manager');
    };
    const countTpl = sqlite.prepare('SELECT COUNT(*) as c FROM checklist_templates').get();
    const runTemplates = () => {
        const insert = sqlite.prepare('INSERT INTO checklist_templates (id,category,title) VALUES (?,?,?)');
        insert.run(randomUUID(), 'safety', '안전보호구 착용');
        insert.run(randomUUID(), 'safety', '비상 정지 버튼 확인');
        insert.run(randomUUID(), 'quality', '제품 검사');
        insert.run(randomUUID(), 'quality', '교정 상태 확인');
    };
    if ((!countUsers || countUsers.c === 0) || (!countTpl || countTpl.c === 0)) {
        const tx = sqlite.transaction(() => {
            if (!countUsers || countUsers.c === 0)
                runUsers();
            if (!countTpl || countTpl.c === 0)
                runTemplates();
        });
        tx();
    }
}
