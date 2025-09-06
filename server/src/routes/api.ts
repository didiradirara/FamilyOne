import { notify } from '../realtime.js';
import express from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { repo } from '../repo.js';
import fs from 'node:fs';
import path from 'node:path';

export const apiRouter = express.Router();
const logsDir = path.resolve(process.cwd(), 'server/logs');
const uploadsDir = path.resolve(process.cwd(), 'server/uploads');
try { fs.mkdirSync(logsDir, { recursive: true }); } catch {}
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}
function auditLog(line: string) {
  try { fs.appendFileSync(path.join(logsDir, 'uploads-audit.log'), `[${new Date().toISOString()}] ${line}\n`); } catch {}
}

// Public org lookup for signup (no auth)
apiRouter.get('/org/teams', (req, res) => {
  const site = typeof req.query.site === 'string' ? req.query.site : undefined;
  const rows = repo.listTeams(site);
  const out = rows.map((r: any) => ({ id: r.id, site: r.site, team: r.team, details: r.detailsJson ? JSON.parse(r.detailsJson) : [] }));
  res.json(out);
});

// Protect everything below
// Register auth middleware directly so Express handles it properly
apiRouter.use(requireAuth);

// Public org lookup (authenticated users)
apiRouter.get('/org/teams', (req, res) => {
  const site = typeof req.query.site === 'string' ? req.query.site : undefined;
  const rows = repo.listTeams(site);
  const out = rows.map((r: any) => ({ id: r.id, site: r.site, team: r.team, details: r.detailsJson ? JSON.parse(r.detailsJson) : [] }));
  res.json(out);
});

// Productions
apiRouter.get('/productions/today', (_req, res) => {
  const today = new Date().toISOString().slice(0,10);
  res.json(repo.listProductionsByDate(today));
});

// Reports
apiRouter.post('/reports', (req, res) => {
  const schema = z.object({
    type: z.enum(['machine_fault', 'material_shortage', 'defect', 'other']),
    message: z.string().min(1),
    images: z.array(z.string()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const creator = repo.findUserById(userId);
  const report = repo.createReport({
    ...parsed.data,
    createdBy: userId,
    site: creator?.site,
    team: creator?.team,
    teamDetail: creator?.teamDetail,
  } as any);
  notify('report:new', report);
  res.status(201).json(report);
});
apiRouter.get('/reports', (req, res) => {
  const filter = {
    site: typeof req.query.site === 'string' ? req.query.site : undefined,
    team: typeof req.query.team === 'string' ? req.query.team : undefined,
    teamDetail: typeof req.query.teamDetail === 'string' ? req.query.teamDetail : undefined,
  };
  res.json(repo.listReports(filter));
});
apiRouter.patch('/reports/:id', requireRole('manager','admin'), (req, res) => {
  const statusSchema = z.object({ status: z.enum(['new', 'ack', 'resolved']) });
  const imagesSchema = z.object({ addImages: z.array(z.string()).min(1) });
  const removeImagesSchema = z.object({ removeImages: z.array(z.string()).min(1) });
  const parsed = statusSchema.safeParse(req.body);
  const parsedImgs = imagesSchema.safeParse(req.body);
  const parsedRem = removeImagesSchema.safeParse(req.body);
  const existing = repo.getReportById(req.params.id); if (!existing) return res.sendStatus(404);
  if (existing.site && req.auth?.site && existing.site !== req.auth.site) return res.status(403).json({ error: 'Forbidden: cross-site' });
  if (parsed.success) {
    const r = repo.updateReportStatus(req.params.id, parsed.data.status);
    if (!r) return res.sendStatus(404);
    notify('report:updated', r);
    return res.json(r);
  } else if (parsedImgs.success) {
    const r = repo.addReportImages(req.params.id, parsedImgs.data.addImages as any);
    if (!r) return res.sendStatus(404);
    notify('report:updated', r);
    return res.json(r);
  } else if (parsedRem.success) {
    const toRemove = parsedRem.data.removeImages as string[];
    const r = repo.removeReportImages(req.params.id, toRemove as any);
    // Also try to delete local files for images under /uploads
    try {
      for (const url of toRemove) {
        if (!url || typeof url !== 'string') continue;
        if (!url.startsWith('/uploads/')) continue;
        const name = url.slice('/uploads/'.length);
        if (!/^[a-zA-Z0-9_.-]+$/.test(name)) continue; // safe filename only
        const filePath = path.join(uploadsDir, name);
        // ensure path is inside uploadsDir
        const rel = path.relative(uploadsDir, filePath);
        if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
          try { fs.unlinkSync(filePath); auditLog(`DELETE OK ${name}`); } catch (e) { auditLog(`DELETE FAIL ${name} ${(e as any)?.message || ''}`); }
        }
      }
    } catch (e) { auditLog(`DELETE LOOP FAIL ${(e as any)?.message || ''}`); }
    if (!r) return res.sendStatus(404);
    notify('report:updated', r);
    return res.json(r);
  }
  return res.status(400).json({ error: 'Invalid payload' });
});

apiRouter.get('/reports/:id/replies', (req, res) => {
  const replies = repo.listReportReplies(req.params.id);
  res.json(replies);
});

apiRouter.post('/reports/:id/replies', (req, res) => {
  const schema = z.object({
    content: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const authorId = req.auth?.sub;
  if (!authorId) return res.status(401).json({ error: 'Unauthorized' });
  const reply = repo.createReportReply({
    ...parsed.data,
    authorId,
    reportId: req.params.id,
  });
  notify('report:updated', reply.report);
  res.status(201).json(reply);
});

// Self-update report (owner only): message/addImages/removeImages
apiRouter.patch('/reports/:id/self', (req, res) => {
  const owner = req.auth?.sub;
  if (!owner) return res.status(401).json({ error: 'Unauthorized' });
  const existing = repo.getReportById(req.params.id);
  if (!existing) return res.sendStatus(404);
  if (existing.createdBy !== owner) return res.status(403).json({ error: 'Forbidden' });
  const msgSchema = z.object({ message: z.string().min(1) });
  const addSchema = z.object({ addImages: z.array(z.string()).min(1) });
  const remSchema = z.object({ removeImages: z.array(z.string()).min(1) });
  const pMsg = msgSchema.safeParse(req.body);
  const pAdd = addSchema.safeParse(req.body);
  const pRem = remSchema.safeParse(req.body);
  if (pMsg.success) {
    const r = repo.updateReportMessage(req.params.id, pMsg.data.message);
    return res.json(r);
  } else if (pAdd.success) {
    const r = repo.addReportImages(req.params.id, pAdd.data.addImages as any);
    return res.json(r);
  } else if (pRem.success) {
    const r = repo.removeReportImages(req.params.id, pRem.data.removeImages as any);
    return res.json(r);
  }
  return res.status(400).json({ error: 'Invalid payload' });
});

// Delete report (owner or admin/manager)
apiRouter.delete('/reports/:id', (req, res) => {
  const auth = req.auth;
  if (!auth?.sub) return res.status(401).json({ error: 'Unauthorized' });
  const existing = repo.getReportById(req.params.id);
  if (!existing) return res.sendStatus(404);
  const can = existing.createdBy === auth.sub || auth.role === 'admin' || auth.role === 'manager';
  if (!can) return res.status(403).json({ error: 'Forbidden' });
  const images: string[] = (existing as any).images || [];
  const out = repo.deleteReport(req.params.id) as any;
  // Remove local files for uploads
  try {
    for (const url of images) {
      if (!url || typeof url !== 'string') continue;
      const name = url.startsWith('/uploads/') ? url.slice('/uploads/'.length) : (url.startsWith('uploads/') ? url.slice('uploads/'.length) : '');
      if (!name) continue;
      if (!/^[a-zA-Z0-9_.-]+$/.test(name)) continue;
      const filePath = path.join(uploadsDir, name);
      const rel = path.relative(uploadsDir, filePath);
      if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
        try { fs.unlinkSync(filePath); auditLog?.(`DELETE FILE OK ${name}`); } catch (e) { auditLog?.(`DELETE FILE FAIL ${name} ${(e as any)?.message || ''}`); }
      }
    }
  } catch {}
  return res.json({ ok: out.ok });
});

// Announcements
apiRouter.post('/announcements', requireRole('manager','admin'), (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    createdBy: z.string().uuid(),
    mustRead: z.boolean().optional(),
    attachmentUrl: z.string().optional(),
    site: z.string().optional(),
    team: z.string().optional(),
    teamDetail: z.string().optional()
  });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const creator = repo.findUserById(parsed.data.createdBy);
  const ann = repo.createAnnouncement({ ...parsed.data, site: creator?.site, team: creator?.team, teamDetail: creator?.teamDetail } as any); notify('announcement:new', ann); res.status(201).json(ann);
});
apiRouter.get('/announcements', (req, res) => {
  const filter = {
    site: typeof req.query.site === 'string' ? req.query.site : undefined,
    team: typeof req.query.team === 'string' ? req.query.team : undefined,
    teamDetail: typeof req.query.teamDetail === 'string' ? req.query.teamDetail : undefined,
  };
  res.json(repo.listAnnouncements(filter));
});
apiRouter.post('/announcements/:id/read', (req, res) => {
  const schema = z.object({ userId: z.string().uuid() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const ann = repo.markAnnouncementRead(req.params.id, parsed.data.userId); if (!ann) return res.sendStatus(404); notify('announcement:read', ann); res.json(ann);
});
apiRouter.get('/announcements/:id/unread', requireRole('manager','admin'), (req, res) => {
  const users = repo.getUnreadUsersForAnnouncement(req.params.id);
  res.json(users);
});

// Checklists
apiRouter.get('/checklists/templates/:category', (req, res) => {
  const cat = req.params.category; if (cat !== 'safety' && cat !== 'quality') return res.sendStatus(404);
  res.json(repo.getChecklistTemplates(cat as any));
});
apiRouter.post('/checklists/submit', (req, res) => {
  const schema = z.object({
    date: z.string().min(8), userId: z.string().uuid(), category: z.enum(['safety','quality']),
    items: z.array(z.object({ id: z.string(), category: z.enum(['safety','quality']), title: z.string(), checked: z.boolean() }))
  });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const sub = repo.submitChecklist(parsed.data as any); notify('checklist:submitted', sub); res.status(201).json(sub);
});

// Leave requests
apiRouter.post('/leave-requests', (req, res) => {
  const schema = z.object({
    userId: z.string().uuid(),
    startDate: z.string(),
    endDate: z.string(),
    reason: z.string().optional(),
    signature: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const lr = repo.createLeaveRequest(parsed.data as any);
  notify('leave:new', lr);
  res.status(201).json(lr);
});
apiRouter.get('/leave-requests', (req, res) => {
  const userId = req.query.userId as string | undefined;
  const list = repo.listLeaveRequests();
  const filtered = userId ? list.filter((lr) => lr.userId === userId) : list;
  const withNames = filtered.map((lr: any) => {
    const u = repo.findUserById(lr.userId);
    return { ...lr, userName: u?.name };
  });
  res.json(withNames);
});
apiRouter.delete('/leave-requests/:id', (req, res) => {
  const id = req.params.id;
  const row = repo.getLeaveById(id);
  if (!row) return res.sendStatus(404);
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (row.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
  if (row.state === 'approved') return res.status(409).json({ error: 'Approved leave cannot be directly deleted' });
  repo.deleteLeave(id);
  res.sendStatus(204);
});
apiRouter.post('/leave-requests/:id/cancel-request', (req, res) => {
  const id = req.params.id;
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
  const updated = repo.requestLeaveCancel(id, userId, reason);
  if (updated === undefined) return res.sendStatus(404);
  if (updated === null) return res.status(409).json({ error: 'Not allowed' });
  res.json(updated);
});
apiRouter.patch('/leave-requests/:id/approve', requireRole('manager','admin'), (req, res) => {
  const schema = z.object({ reviewerId: z.string().uuid() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const it = repo.setLeaveState(req.params.id, 'approved', parsed.data.reviewerId); if (!it) return res.sendStatus(404); notify('leave:approved', it); res.json(it);
});
apiRouter.patch('/leave-requests/:id/reject', requireRole('manager','admin'), (req, res) => {
  const schema = z.object({ reviewerId: z.string().uuid(), rejectionReason: z.string().optional() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const it = repo.setLeaveState(req.params.id, 'rejected', parsed.data.reviewerId, parsed.data.rejectionReason); if (!it) return res.sendStatus(404); notify('leave:rejected', it); res.json(it);
});

// Schedule (CRUD)
apiRouter.get('/schedule', (req, res) => {
  const user = req.auth;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const teamFilter = typeof req.query.team === 'string' ? req.query.team : undefined;

  if (user.role === 'admin') {
    const shifts = repo.listShifts({ team: teamFilter });
    return res.json(shifts);
  }

  if (user.role === 'manager') {
    const shifts = repo.listShifts({ team: user.team });
    return res.json(shifts);
  }

  const shifts = repo.listShifts({ userId: user.sub });
  res.json(shifts);
});
apiRouter.post('/schedule', requireRole('manager','admin'), (req, res) => {
  const schema = z.object({ date: z.string().min(8), userId: z.string().uuid(), shift: z.string().min(1) });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const sh = repo.createShift(parsed.data as any); res.status(201).json(sh);
});
apiRouter.patch('/schedule/:id', requireRole('manager','admin'), (req, res) => {
  const schema = z.object({ date: z.string().min(8).optional(), userId: z.string().uuid().optional(), shift: z.string().min(1).optional() }).refine(d => Object.keys(d).length > 0, { message: 'empty' });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const sh = repo.updateShift(req.params.id, parsed.data as any); if (!sh) return res.sendStatus(404); res.json(sh);
});
apiRouter.delete('/schedule/:id', requireRole('manager','admin'), (req, res) => {
  repo.deleteShift(req.params.id); res.sendStatus(204);
});

// Leave summary: total, used, remaining
apiRouter.get('/leave/summary', (req, res) => {
  const yearParam = req.query.year as string | undefined;
  let year = new Date().getFullYear();
  if (yearParam && /^\d{4}$/.test(yearParam)) year = Number(yearParam);
  const userId = (req.query.userId as string | undefined) || req.auth?.sub;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const alloc = repo.getLeaveAllocation(userId, year);
  const totalDays = alloc?.totalDays ?? 0;
  const usedDays = repo.computeApprovedLeaveDays(userId, year) ?? 0;
  const remainingDays = Math.max(0, totalDays - usedDays);
  res.json({ year, userId, totalDays, usedDays, remainingDays });
});

// Leave allocations (admin/manager): upsert and list
apiRouter.post('/leave/allocations', requireRole('manager','admin'), (req, res) => {
  const schema = z.object({ userId: z.string().uuid(), year: z.number().int().min(2000).max(3000), totalDays: z.number().int().min(0).max(365) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const row = repo.upsertLeaveAllocation(parsed.data.userId, parsed.data.year, parsed.data.totalDays);
  res.status(201).json(row);
});
apiRouter.get('/leave/allocations', requireRole('manager','admin'), (req, res) => {
  const year = typeof req.query.year === 'string' && /^\d{4}$/.test(req.query.year as string) ? Number(req.query.year) : undefined;
  const list = repo.listLeaveAllocations(year);
  res.json(list);
});

// Trainings
apiRouter.get('/trainings', (req, res) => {
  const year = new Date().getFullYear();
  const yearParam = Number(req.query.year);
  res.json(repo.listTrainings(isNaN(yearParam) ? year : yearParam));
});
apiRouter.get('/trainings/:id', (req, res) => {
  const training = repo.getTrainingById(req.params.id);
  if (!training) return res.sendStatus(404);
  res.json(training);
});
apiRouter.post('/trainings/:id/complete', (req, res) => {
  const schema = z.object({ signature: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const completion = repo.createTrainingCompletion({
    trainingId: req.params.id,
    userId,
    signature: parsed.data.signature,
  });
  res.status(201).json(completion);
});
apiRouter.get('/training-completions', (req, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  res.json(repo.listTrainingCompletions(userId));
});

// Uploads (base64 JSON)
apiRouter.post('/uploads/base64', (req, res) => {
  function uniqueName(base: string) {
    // ensure unique filename by appending timestamp + random token before extension
    const dot = base.lastIndexOf('.');
    const name = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return `${name}_${token}${ext}`;
  }
  const schema = z.object({ filename: z.string().optional(), data: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { filename, data } = parsed.data;
  const m = /^data:(.*?);base64,(.*)$/.exec(data);
  const b64 = m ? m[2] : data;
  const ext = m ? (m[1]?.split('/')[1] || 'bin') : 'bin';
  const provided = (filename && filename.replace(/[^a-zA-Z0-9_.-]/g, '')) || `upload.${ext}`;
  const finalName = uniqueName(provided);
  const filePath = path.join(uploadsDir, finalName);
  try {
    fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
    const url = `/uploads/${finalName}`;
    auditLog(`UPLOAD OK ${finalName}`);
    res.status(201).json({ url });
  } catch (e) {
    auditLog(`UPLOAD FAIL ${finalName || 'unknown'} ${(e as any)?.message || ''}`);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Uploads (streaming, application/octet-stream)
// Usage: POST /api/uploads/stream?filename=foo.jpg with raw body, or send header x-filename
apiRouter.post('/uploads/stream', (req, res) => {
  function uniqueName(base: string) {
    const dot = base.lastIndexOf('.');
    const name = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return `${name}_${token}${ext}`;
  }
  // Only allow non-JSON raw bodies here. express.json doesn't consume octet-stream
  const headerName = (req.headers['x-filename'] as string | undefined) || '';
  const qName = typeof req.query.filename === 'string' ? (req.query.filename as string) : '';
  const contentType = (req.headers['content-type'] as string | undefined) || '';
  const nameSrc = (qName || headerName || '').replace(/[^a-zA-Z0-9_.-]/g, '');
  let ext = 'bin';
  const ct = contentType.split(';')[0].trim();
  if (ct === 'image/jpeg') ext = 'jpg';
  else if (ct === 'image/png') ext = 'png';
  else if (ct === 'image/webp') ext = 'webp';
  else if (ct === 'image/gif') ext = 'gif';
  const baseName = nameSrc || `upload.${ext}`;
  const finalName = uniqueName(baseName);
  const filePath = path.join(uploadsDir, finalName);

  // Enforce size limit
  const maxBytes = Number(process.env.UPLOAD_STREAM_MAX_BYTES || 25 * 1024 * 1024);
  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength && contentLength > maxBytes) {
    auditLog(`STREAM REJECT length>${maxBytes} name=${baseName}`);
    return res.status(413).json({ error: 'Payload too large' });
  }

  try {
    const ws = fs.createWriteStream(filePath);
    let written = 0;
    req.on('data', (chunk) => {
      written += chunk.length;
      if (written > maxBytes) {
        auditLog(`STREAM ABORT too large name=${baseName}`);
        ws.destroy();
        try { fs.unlinkSync(filePath); } catch {}
        req.destroy();
      }
    });
    req.pipe(ws);
    ws.on('finish', () => {
      const url = `/uploads/${finalName}`;
      auditLog(`STREAM OK ${finalName} ${written}b`);
      res.status(201).json({ url });
    });
    ws.on('error', (e) => {
      auditLog(`STREAM FAIL ${finalName} ${(e as any)?.message || ''}`);
      try { fs.unlinkSync(filePath); } catch {}
      res.status(500).json({ error: 'Failed to save file' });
    });
  } catch (e) {
    auditLog(`STREAM EXC ${finalName} ${(e as any)?.message || ''}`);
    return res.status(500).json({ error: 'Failed to init stream' });
  }
});

// Org admin (admin only)
apiRouter.get('/org', requireRole('admin'), (_req, res) => {
  const sites = repo.listSites();
  const teams = repo.listTeams();
  const grouped: any = {};
  for (const s of sites) grouped[s.site] = [];
  for (const t of teams) {
    if (!grouped[t.site]) grouped[t.site] = [];
    grouped[t.site].push({ id: t.id, team: t.team, details: t.detailsJson ? JSON.parse(t.detailsJson) : [] });
  }
  res.json({ sites, teams: grouped });
});
apiRouter.post('/org/team', requireRole('admin'), (req, res) => {
  const schema = z.object({ site: z.string(), team: z.string().min(1), details: z.array(z.string()).optional() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const t = repo.createTeam(parsed.data.site, parsed.data.team, parsed.data.details ?? []);
  res.status(201).json(t);
});
apiRouter.patch('/org/team/:id', requireRole('admin'), (req, res) => {
  const schema = z.object({ site: z.string().optional(), team: z.string().min(1).optional(), details: z.array(z.string()).optional() }).refine(d => Object.keys(d).length>0, { message: 'empty' });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const t = repo.updateTeam(req.params.id, parsed.data as any); if (!t) return res.sendStatus(404); res.json(t);
});
apiRouter.delete('/org/team/:id', requireRole('admin'), (req, res) => { repo.deleteTeam(req.params.id); res.sendStatus(204); });
