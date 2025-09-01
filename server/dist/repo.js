import { sqlite } from './db/sqlite.js';
import { v4 as uuid } from 'uuid';
export const repo = {
    // Users
    createUser(name, role) {
        const id = uuid();
        sqlite.prepare('INSERT INTO users (id,name,role) VALUES (?,?,?)').run(id, name, role);
        return { id, name, role };
    },
    findUserById(id) {
        return sqlite.prepare('SELECT id,name,role FROM users WHERE id = ?').get(id);
    },
    findUserByName(name) {
        return sqlite.prepare('SELECT id,name,role FROM users WHERE name = ?').get(name);
    },
    // Reports
    createReport(data) {
        const id = uuid();
        const now = new Date().toISOString();
        sqlite.prepare('INSERT INTO reports (id,type,message,createdAt,createdBy,status) VALUES (?,?,?,?,?,?)')
            .run(id, data.type, data.message, now, data.createdBy, 'new');
        return { id, type: data.type, message: data.message, createdAt: now, createdBy: data.createdBy, status: 'new' };
    },
    listReports() {
        return sqlite.prepare('SELECT * FROM reports ORDER BY createdAt DESC').all();
    },
    updateReportStatus(id, status) {
        sqlite.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, id);
        return sqlite.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    },
    // Requests
    createRequest(data) {
        const id = uuid();
        const now = new Date().toISOString();
        sqlite.prepare('INSERT INTO requests (id,kind,details,createdAt,createdBy,state) VALUES (?,?,?,?,?,?)')
            .run(id, data.kind, data.details, now, data.createdBy, 'pending');
        return { id, kind: data.kind, details: data.details, createdAt: now, createdBy: data.createdBy, state: 'pending' };
    },
    listRequests() { return sqlite.prepare('SELECT * FROM requests ORDER BY createdAt DESC').all(); },
    setRequestState(id, state, reviewerId) {
        const ts = new Date().toISOString();
        sqlite.prepare('UPDATE requests SET state=?, reviewerId=?, reviewedAt=? WHERE id=?').run(state, reviewerId, ts, id);
        return sqlite.prepare('SELECT * FROM requests WHERE id=?').get(id);
    },
    // Announcements
    createAnnouncement(data) {
        const id = uuid();
        const now = new Date().toISOString();
        sqlite.prepare('INSERT INTO announcements (id,title,body,createdAt,createdBy,readBy) VALUES (?,?,?,?,?,?)')
            .run(id, data.title, data.body, now, data.createdBy, JSON.stringify([]));
        return { id, title: data.title, body: data.body, createdAt: now, createdBy: data.createdBy, readBy: [] };
    },
    listAnnouncements() {
        const rows = sqlite.prepare('SELECT * FROM announcements ORDER BY createdAt DESC').all();
        return rows.map(r => ({ ...r, readBy: JSON.parse(r.readBy) }));
    },
    markAnnouncementRead(id, userId) {
        const row = sqlite.prepare('SELECT * FROM announcements WHERE id=?').get(id);
        if (!row)
            return undefined;
        const readBy = JSON.parse(row.readBy);
        if (!readBy.includes(userId)) {
            readBy.push(userId);
            sqlite.prepare('UPDATE announcements SET readBy=? WHERE id=?').run(JSON.stringify(readBy), id);
        }
        const updated = sqlite.prepare('SELECT * FROM announcements WHERE id=?').get(id);
        return { ...updated, readBy: JSON.parse(updated.readBy) };
    },
    // Checklists
    getChecklistTemplates(category) {
        return sqlite.prepare('SELECT id, category, title FROM checklist_templates WHERE category = ?').all(category);
    },
    submitChecklist(data) {
        const id = uuid();
        sqlite.prepare('INSERT INTO checklist_submissions (id,date,userId,category,itemsJson) VALUES (?,?,?,?,?)')
            .run(id, data.date, data.userId, data.category, JSON.stringify(data.items));
        return { id, ...data };
    },
    // Suggestions
    createSuggestion(data) {
        const id = uuid();
        const now = new Date().toISOString();
        sqlite.prepare('INSERT INTO suggestions (id,text,createdAt,anonymous,createdBy) VALUES (?,?,?,?,?)')
            .run(id, data.text, now, data.anonymous ? 1 : 0, data.createdBy ?? null);
        return { id, text: data.text, createdAt: now, anonymous: data.anonymous, createdBy: data.createdBy };
    },
    listSuggestions() { return sqlite.prepare('SELECT * FROM suggestions ORDER BY createdAt DESC').all(); },
    // Leave requests
    createLeaveRequest(data) {
        const id = uuid();
        sqlite.prepare('INSERT INTO leave_requests (id,userId,startDate,endDate,reason,state) VALUES (?,?,?,?,?,?)')
            .run(id, data.userId, data.startDate, data.endDate, data.reason ?? null, 'pending');
        return { id, ...data, state: 'pending' };
    },
    listLeaveRequests() { return sqlite.prepare('SELECT * FROM leave_requests ORDER BY startDate DESC').all(); },
    setLeaveState(id, state, reviewerId) {
        const ts = new Date().toISOString();
        sqlite.prepare('UPDATE leave_requests SET state=?, reviewerId=?, reviewedAt=? WHERE id=?').run(state, reviewerId, ts, id);
        return sqlite.prepare('SELECT * FROM leave_requests WHERE id=?').get(id);
    },
};
