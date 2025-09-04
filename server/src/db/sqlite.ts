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
  role TEXT NOT NULL CHECK (role IN ('worker','manager','admin')),
  site TEXT,
  team TEXT,
  teamDetail TEXT
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('machine_fault','material_shortage','defect','other')),
  message TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new','ack','resolved')),
  imagesJson TEXT
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

CREATE TABLE IF NOT EXISTS productions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  userId TEXT NOT NULL,
  shift TEXT NOT NULL
);
`;

  sqlite.exec(schema);

  // Migrations for users: add site/team/teamDetail if missing
  try {
    const cols = sqlite.prepare('PRAGMA table_info(users)').all() as any[];
    const names = cols.map(c => c.name);
    if (!names.includes('site')) sqlite.exec("ALTER TABLE users ADD COLUMN site TEXT");
    if (!names.includes('team')) sqlite.exec("ALTER TABLE users ADD COLUMN team TEXT");
    if (!names.includes('teamDetail')) sqlite.exec("ALTER TABLE users ADD COLUMN teamDetail TEXT");
  } catch {}

  // Safe migration: add imagesJson column to reports if missing
  try {
    const cols = sqlite.prepare("PRAGMA table_info(reports)").all() as any[];
    const hasImages = cols.some(c => c.name === 'imagesJson');
    if (!hasImages) {
      sqlite.exec("ALTER TABLE reports ADD COLUMN imagesJson TEXT");
    }
    if (!cols.some(c => c.name === 'site')) sqlite.exec("ALTER TABLE reports ADD COLUMN site TEXT");
    if (!cols.some(c => c.name === 'team')) sqlite.exec("ALTER TABLE reports ADD COLUMN team TEXT");
    if (!cols.some(c => c.name === 'teamDetail')) sqlite.exec("ALTER TABLE reports ADD COLUMN teamDetail TEXT");
  } catch {}

  // Migrations for requests: add site/team/teamDetail
  try {
    const cols = sqlite.prepare('PRAGMA table_info(requests)').all() as any[];
    const names = cols.map(c => c.name);
    if (!names.includes('site')) sqlite.exec("ALTER TABLE requests ADD COLUMN site TEXT");
    if (!names.includes('team')) sqlite.exec("ALTER TABLE requests ADD COLUMN team TEXT");
    if (!names.includes('teamDetail')) sqlite.exec("ALTER TABLE requests ADD COLUMN teamDetail TEXT");
  } catch {}

  // Migrations for announcements: add site/team/teamDetail
  try {
    const cols = sqlite.prepare('PRAGMA table_info(announcements)').all() as any[];
    const names = cols.map(c => c.name);
    if (!names.includes('site')) sqlite.exec("ALTER TABLE announcements ADD COLUMN site TEXT");
    if (!names.includes('team')) sqlite.exec("ALTER TABLE announcements ADD COLUMN team TEXT");
    if (!names.includes('teamDetail')) sqlite.exec("ALTER TABLE announcements ADD COLUMN teamDetail TEXT");
  } catch {}

  // Org tables
  sqlite.exec(`CREATE TABLE IF NOT EXISTS sites (site TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS site_teams (id TEXT PRIMARY KEY, site TEXT NOT NULL, team TEXT NOT NULL, detailsJson TEXT);
`);
}

export function seedDb() {
  const countUsers = sqlite.prepare('SELECT COUNT(*) as c FROM users').get() as any;
  const runUsers = () => {
    const insert = sqlite.prepare('INSERT INTO users (id,name,role,site,team,teamDetail) VALUES (?,?,?,?,?,?)');
    insert.run(randomUUID(), '작업자A', 'worker', 'jeonju', '생산지원팀', null);
    insert.run(randomUUID(), '매니저B', 'manager', 'busan', '부산공장장', null);
  };

  const countTpl = sqlite.prepare('SELECT COUNT(*) as c FROM checklist_templates').get() as any;
  const runTemplates = () => {
    const insert = sqlite.prepare('INSERT INTO checklist_templates (id,category,title) VALUES (?,?,?)');
    insert.run(randomUUID(), 'safety', '안전보호구 착용');
    insert.run(randomUUID(), 'safety', '비상 정지 버튼 확인');
    insert.run(randomUUID(), 'quality', '제품 검사');
    insert.run(randomUUID(), 'quality', '교정 상태 확인');
  };

  if ((!countUsers || countUsers.c === 0) || (!countTpl || countTpl.c === 0)) {
    const tx = sqlite.transaction(() => {
      if (!countUsers || countUsers.c === 0) runUsers();
      if (!countTpl || countTpl.c === 0) runTemplates();
    });
    tx();
  }

  // Seed productions for today if empty
  try {
    const countProd = sqlite.prepare('SELECT COUNT(*) as c FROM productions').get() as any;
    if (!countProd || countProd.c === 0) {
      const today = new Date().toISOString().slice(0,10);
      const ins = sqlite.prepare('INSERT INTO productions (id,date,name) VALUES (?,?,?)');
      ins.run(randomUUID(), today, '샘플제품A');
      ins.run(randomUUID(), today, '샘플제품B');
    }
  } catch {}

  // Seed org structure (if empty)
  try {
    const countSites = sqlite.prepare('SELECT COUNT(*) as c FROM sites').get() as any;
    if (!countSites || countSites.c === 0) {
      const tx2 = sqlite.transaction(() => {
        sqlite.prepare('INSERT INTO sites (site,name) VALUES (?,?)').run('hq','본사');
        sqlite.prepare('INSERT INTO sites (site,name) VALUES (?,?)').run('jeonju','전주공장');
        sqlite.prepare('INSERT INTO sites (site,name) VALUES (?,?)').run('busan','부산공장');
        const insTeam = sqlite.prepare('INSERT INTO site_teams (id,site,team,detailsJson) VALUES (?,?,?,?)');
        ['전주공장장','생산지원팀','생산팀','공무팀','개발팀'].forEach(t => {
          const details = t==='생산팀' ? JSON.stringify(['생산 1담당','생산 2담당']) : JSON.stringify([]);
          insTeam.run(randomUUID(),'jeonju',t,details);
        });
        ['부산공장장','생산지원팀','품질개선팀','공무팀','생산팀'].forEach(t => insTeam.run(randomUUID(),'busan',t,JSON.stringify([])));
        insTeam.run(randomUUID(),'hq','본사',JSON.stringify([]));
      });
      tx2();
    }
  } catch {}
}
