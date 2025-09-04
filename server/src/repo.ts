import { sqlite } from './db/sqlite.js';
import { v4 as uuid } from 'uuid';
import type { Role, Report, RequestItem, Announcement, ChecklistSubmission, Suggestion, LeaveRequest, User } from './types.js';

export const repo = {
  // Users
  createUser(name: string, role: Role, site: 'hq'|'jeonju'|'busan', team: string, teamDetail?: string | null): User {
    const id = uuid();
    sqlite.prepare('INSERT INTO users (id,name,role,site,team,teamDetail) VALUES (?,?,?,?,?,?)').run(id, name, role, site, team, teamDetail ?? null);
    return { id, name, role, site, team, teamDetail: teamDetail ?? null } as any;
  },
  findUserById(id: string) {
    return sqlite.prepare('SELECT id,name,role,site,team,teamDetail FROM users WHERE id = ?').get(id) as any;
  },
  findUserByName(name: string) {
    return sqlite.prepare('SELECT id,name,role,site,team,teamDetail FROM users WHERE name = ?').get(name) as any;
  },

  // Reports
  createReport(data: { type: string; message: string; createdBy: string; images?: string[]; site?: string; team?: string; teamDetail?: string | null }): Report {
    const id = uuid();
    const now = new Date().toISOString();
    const imagesJson = JSON.stringify(data.images ?? []);
    sqlite.prepare('INSERT INTO reports (id,type,message,createdAt,createdBy,status,imagesJson,site,team,teamDetail) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id, data.type, data.message, now, data.createdBy, 'new', imagesJson, data.site ?? null, data.team ?? null, data.teamDetail ?? null);
    return { id, type: data.type as any, message: data.message, createdAt: now, createdBy: data.createdBy, status: 'new', images: data.images ?? [], site: data.site, team: data.team, teamDetail: data.teamDetail } as any;
  },
  listReports(filter?: { site?: string; team?: string; teamDetail?: string }): Report[] {
    const where: string[] = [];
    const params: any[] = [];
    if (filter?.site) { where.push('site = ?'); params.push(filter.site); }
    if (filter?.team) { where.push('team = ?'); params.push(filter.team); }
    if (filter?.teamDetail) { where.push('teamDetail = ?'); params.push(filter.teamDetail); }
    const sql = `SELECT * FROM reports ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY createdAt DESC`;
    const rows = sqlite.prepare(sql).all(...params) as any[];
    return rows.map(r => ({ ...r, images: r.imagesJson ? JSON.parse(r.imagesJson) : [] })) as any;
  },
  updateReportStatus(id: string, status: 'new'|'ack'|'resolved') {
    sqlite.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, id);
    const row = sqlite.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any;
    return row ? { ...row, images: row.imagesJson ? JSON.parse(row.imagesJson) : [] } : undefined as any;
  },
  updateReportMessage(id: string, message: string) {
    sqlite.prepare('UPDATE reports SET message = ? WHERE id = ?').run(message, id);
    const row = sqlite.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any;
    return row ? { ...row, images: row.imagesJson ? JSON.parse(row.imagesJson) : [] } : undefined as any;
  },
  getReportById(id: string) {
    const row = sqlite.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any;
    return row ? { ...row, images: row.imagesJson ? JSON.parse(row.imagesJson) : [] } : undefined as any;
  },
  deleteReport(id: string) {
    const row = sqlite.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any;
    if (!row) return { ok: false, row: null } as any;
    sqlite.prepare('DELETE FROM reports WHERE id = ?').run(id);
    return { ok: true, row } as any;
  },
  addReportImages(id: string, images: string[]) {
    const row = sqlite.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    const current: string[] = row.imagesJson ? JSON.parse(row.imagesJson) : [];
    const next = [...current, ...images];
    sqlite.prepare('UPDATE reports SET imagesJson = ? WHERE id = ?').run(JSON.stringify(next), id);
    const updated = sqlite.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any;
    return { ...updated, images: updated.imagesJson ? JSON.parse(updated.imagesJson) : [] } as any;
  },
  removeReportImages(id: string, images: string[]) {
    const row = sqlite.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    const current: string[] = row.imagesJson ? JSON.parse(row.imagesJson) : [];
    const set = new Set(images);
    const next = current.filter((u: string) => !set.has(u));
    sqlite.prepare('UPDATE reports SET imagesJson = ? WHERE id = ?').run(JSON.stringify(next), id);
    const updated = sqlite.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any;
    return { ...updated, images: updated.imagesJson ? JSON.parse(updated.imagesJson) : [] } as any;
  },

  // Org structure
  listSites() { return sqlite.prepare('SELECT site,name FROM sites').all() as any[]; },
  listTeams(site?: string) {
    if (site) return sqlite.prepare('SELECT id,site,team,detailsJson FROM site_teams WHERE site = ?').all(site) as any[];
    return sqlite.prepare('SELECT id,site,team,detailsJson FROM site_teams').all() as any[];
  },
  createTeam(site: string, team: string, details: string[]) {
    const id = uuid();
    sqlite.prepare('INSERT INTO site_teams (id,site,team,detailsJson) VALUES (?,?,?,?)').run(id, site, team, JSON.stringify(details || []));
    return sqlite.prepare('SELECT id,site,team,detailsJson FROM site_teams WHERE id=?').get(id) as any;
  },
  updateTeam(id: string, patch: Partial<{ site: string; team: string; details: string[] }>) {
    const cur = sqlite.prepare('SELECT * FROM site_teams WHERE id=?').get(id) as any;
    if (!cur) return undefined;
    const next = {
      site: patch.site ?? cur.site,
      team: patch.team ?? cur.team,
      detailsJson: JSON.stringify(patch.details ?? (cur.detailsJson ? JSON.parse(cur.detailsJson) : [])),
    };
    sqlite.prepare('UPDATE site_teams SET site=?, team=?, detailsJson=? WHERE id=?').run(next.site, next.team, next.detailsJson, id);
    return sqlite.prepare('SELECT id,site,team,detailsJson FROM site_teams WHERE id=?').get(id) as any;
  },
  deleteTeam(id: string) {
    sqlite.prepare('DELETE FROM site_teams WHERE id=?').run(id);
    return true;
  },
  validateTeam(site: string, team: string, teamDetail?: string | null) {
    const rows = sqlite.prepare('SELECT team, detailsJson FROM site_teams WHERE site = ? AND team = ?').all(site, team) as any[];
    if (!rows || rows.length === 0) return false;
    const details: string[] = rows[0].detailsJson ? JSON.parse(rows[0].detailsJson) : [];
    if (details.length === 0) return true;
    if (!teamDetail) return false;
    return details.includes(teamDetail);
  },
  // Requests
  createRequest(data: { kind: string; details: string; createdBy: string; site?: string; team?: string; teamDetail?: string | null }): RequestItem {
    const id = uuid(); const now = new Date().toISOString();
    sqlite.prepare('INSERT INTO requests (id,kind,details,createdAt,createdBy,state,site,team,teamDetail) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, data.kind, data.details, now, data.createdBy, 'pending', data.site ?? null, data.team ?? null, data.teamDetail ?? null);
    return { id, kind: data.kind as any, details: data.details, createdAt: now, createdBy: data.createdBy, state: 'pending', site: data.site, team: data.team, teamDetail: data.teamDetail } as any;
  },
  listRequests(filter?: { site?: string; team?: string; teamDetail?: string }): RequestItem[] {
    const where: string[] = []; const params: any[] = [];
    if (filter?.site) { where.push('site = ?'); params.push(filter.site); }
    if (filter?.team) { where.push('team = ?'); params.push(filter.team); }
    if (filter?.teamDetail) { where.push('teamDetail = ?'); params.push(filter.teamDetail); }
    const sql = `SELECT * FROM requests ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY createdAt DESC`;
    return sqlite.prepare(sql).all(...params) as any;
  },
  setRequestState(id: string, state: 'approved'|'rejected', reviewerId: string) {
    const ts = new Date().toISOString();
    sqlite.prepare('UPDATE requests SET state=?, reviewerId=?, reviewedAt=? WHERE id=?').run(state, reviewerId, ts, id);
    return sqlite.prepare('SELECT * FROM requests WHERE id=?').get(id) as any;
  },

  // Announcements
  createAnnouncement(data: { title: string; body: string; createdBy: string; site?: string; team?: string; teamDetail?: string | null }): Announcement {
    const id = uuid(); const now = new Date().toISOString();
    sqlite.prepare('INSERT INTO announcements (id,title,body,createdAt,createdBy,readBy,site,team,teamDetail) VALUES (?,?,?,?,?,?,?, ?, ?)')
      .run(id, data.title, data.body, now, data.createdBy, JSON.stringify([]), data.site ?? null, data.team ?? null, data.teamDetail ?? null);
    return { id, title: data.title, body: data.body, createdAt: now, createdBy: data.createdBy, readBy: [], site: data.site, team: data.team, teamDetail: data.teamDetail } as any;
  },
  getRequestById(id: string) {
    return sqlite.prepare('SELECT * FROM requests WHERE id=?').get(id) as any;
  },
  listAnnouncements(filter?: { site?: string; team?: string; teamDetail?: string }): Announcement[] {
    const where: string[] = []; const params: any[] = [];
    if (filter?.site) { where.push('site = ?'); params.push(filter.site); }
    if (filter?.team) { where.push('team = ?'); params.push(filter.team); }
    if (filter?.teamDetail) { where.push('teamDetail = ?'); params.push(filter.teamDetail); }
    const sql = `SELECT * FROM announcements ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY createdAt DESC`;
    const rows = sqlite.prepare(sql).all(...params) as any[];
    return rows.map(r => ({ ...r, readBy: JSON.parse(r.readBy) })) as any;
  },
  markAnnouncementRead(id: string, userId: string) {
    const row = sqlite.prepare('SELECT * FROM announcements WHERE id=?').get(id) as any;
    if (!row) return undefined;
    const readBy: string[] = JSON.parse(row.readBy);
    if (!readBy.includes(userId)) { readBy.push(userId); sqlite.prepare('UPDATE announcements SET readBy=? WHERE id=?').run(JSON.stringify(readBy), id); }
    const updated = sqlite.prepare('SELECT * FROM announcements WHERE id=?').get(id) as any;
    return { ...updated, readBy: JSON.parse(updated.readBy) } as any;
  },

  // Checklists
  getChecklistTemplates(category: 'safety'|'quality') {
    return sqlite.prepare('SELECT id, category, title FROM checklist_templates WHERE category = ?').all(category) as any[];
  },
  submitChecklist(data: { date: string; userId: string; category: 'safety'|'quality'; items: any[] }): ChecklistSubmission {
    const id = uuid(); sqlite.prepare('INSERT INTO checklist_submissions (id,date,userId,category,itemsJson) VALUES (?,?,?,?,?)')
      .run(id, data.date, data.userId, data.category, JSON.stringify(data.items));
    return { id, ...data } as any;
  },

  // Suggestions
  createSuggestion(data: { text: string; anonymous: boolean; createdBy?: string }): Suggestion {
    const id = uuid(); const now = new Date().toISOString();
    sqlite.prepare('INSERT INTO suggestions (id,text,createdAt,anonymous,createdBy) VALUES (?,?,?,?,?)')
      .run(id, data.text, now, data.anonymous ? 1 : 0, data.createdBy ?? null);
    return { id, text: data.text, createdAt: now, anonymous: data.anonymous, createdBy: data.createdBy } as any;
  },
  listSuggestions(): Suggestion[] { return sqlite.prepare('SELECT * FROM suggestions ORDER BY createdAt DESC').all() as any; },

  // Leave requests
  createLeaveRequest(data: { userId: string; startDate: string; endDate: string; reason?: string }): LeaveRequest {
    const id = uuid();
    sqlite.prepare('INSERT INTO leave_requests (id,userId,startDate,endDate,reason,state) VALUES (?,?,?,?,?,?)')
      .run(id, data.userId, data.startDate, data.endDate, data.reason ?? null, 'pending');
    return { id, ...data, state: 'pending' } as any;
  },
  listLeaveRequests(): LeaveRequest[] { return sqlite.prepare('SELECT * FROM leave_requests ORDER BY startDate DESC').all() as any; },
  setLeaveState(id: string, state: 'approved'|'rejected', reviewerId: string) {
    const ts = new Date().toISOString();
    sqlite.prepare('UPDATE leave_requests SET state=?, reviewerId=?, reviewedAt=? WHERE id=?').run(state, reviewerId, ts, id);
    return sqlite.prepare('SELECT * FROM leave_requests WHERE id=?').get(id) as any;
  },

  // Schedule (shifts)
  createShift(data: { date: string; userId: string; shift: string }) {
    const id = uuid();
    sqlite.prepare('INSERT INTO shifts (id,date,userId,shift) VALUES (?,?,?,?)')
      .run(id, data.date, data.userId, data.shift);
    return { id, ...data } as any;
  },
  listShifts() { return sqlite.prepare('SELECT * FROM shifts ORDER BY date DESC').all() as any[]; },
  updateShift(id: string, patch: Partial<{ date: string; userId: string; shift: string }>) {
    const cur = sqlite.prepare('SELECT * FROM shifts WHERE id=?').get(id) as any;
    if (!cur) return undefined;
    const next = { ...cur, ...patch };
    sqlite.prepare('UPDATE shifts SET date=?, userId=?, shift=? WHERE id=?')
      .run(next.date, next.userId, next.shift, id);
    return sqlite.prepare('SELECT * FROM shifts WHERE id=?').get(id) as any;
  },
  deleteShift(id: string) { sqlite.prepare('DELETE FROM shifts WHERE id=?').run(id); return true; },

  // Productions
  createProduction(data: { date: string; name: string }) {
    const id = uuid();
    sqlite.prepare('INSERT INTO productions (id,date,name) VALUES (?,?,?)').run(id, data.date, data.name);
    return { id, ...data } as any;
  },
  listProductionsByDate(date: string) {
    return sqlite.prepare('SELECT * FROM productions WHERE date = ?').all(date) as any[];
  },
};
