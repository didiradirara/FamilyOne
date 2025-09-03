import { notify } from '../realtime.js';
import express from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, signToken } from '../middleware/auth.js';
import { repo } from '../repo.js';
import fs from 'node:fs';
import path from 'node:path';

export const apiRouter = express.Router();
const logsDir = path.resolve(process.cwd(), 'server/logs');
try { fs.mkdirSync(logsDir, { recursive: true }); } catch {}
function auditLog(line: string) {
  try { fs.appendFileSync(path.join(logsDir, 'uploads-audit.log'), `[${new Date().toISOString()}] ${line}\n`); } catch {}
}

// Auth (unprotected)
apiRouter.post('/auth/register', (req, res) => {
  const siteSchema = z.enum(['hq','jeonju','busan']);
  const baseSchema = z.object({ name: z.string().min(1), role: z.enum(['worker','manager','admin']), site: siteSchema, team: z.string().min(1), teamDetail: z.string().optional() });
  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { name, role, site, team, teamDetail } = parsed.data;
  // validate by org tables
  const ok = repo.validateTeam(site, team, teamDetail);
  if (!ok) return res.status(400).json({ error: 'Invalid team/site combination' });
  const user = repo.createUser(name, role, site, team, teamDetail);
  const token = signToken(user as any);
  res.status(201).json({ token, user });
});

apiRouter.post('/auth/login', (req, res) => {
  console.log('[Auth] login request', req.body);
  const schema = z.object({ userId: z.string().uuid().optional(), name: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  let user: any;
  if (parsed.data.userId) user = repo.findUserById(parsed.data.userId);
  else if (parsed.data.name) user = repo.findUserByName(parsed.data.name);
  if (!user) {
    console.warn('[Auth] login failed: user not found', req.body);
    return res.status(404).json({ error: 'User not found' });
  }
  const token = signToken(user);
  console.log('[Auth] login success', { userId: user.id });
  res.json({ token, user });
});

// Public org lookup for signup (no auth)
apiRouter.get('/org/teams', (req, res) => {
  const site = typeof req.query.site === 'string' ? req.query.site : undefined;
  const rows = repo.listTeams(site);
  const out = rows.map((r: any) => ({ id: r.id, site: r.site, team: r.team, details: r.detailsJson ? JSON.parse(r.detailsJson) : [] }));
  res.json(out);
});

// Protect everything below
apiRouter.use((req, res, next) => {
  if (req.path.startsWith('/auth')) return next();
  return requireAuth(req, res, next);
});

// Public org lookup (authenticated users)
apiRouter.get('/org/teams', (req, res) => {
  const site = typeof req.query.site === 'string' ? req.query.site : undefined;
  const rows = repo.listTeams(site);
  const out = rows.map((r: any) => ({ id: r.id, site: r.site, team: r.team, details: r.detailsJson ? JSON.parse(r.detailsJson) : [] }));
  res.json(out);
});

// Reports
apiRouter.post('/reports', (req, res) => {
  const schema = z.object({
    type: z.enum(['machine_fault', 'material_shortage', 'defect', 'other']),
    message: z.string().min(1),
    createdBy: z.string().uuid(),
    images: z.array(z.string()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const creator = repo.findUserById(parsed.data.createdBy);
  const report = repo.createReport({ ...parsed.data, site: creator?.site, team: creator?.team, teamDetail: creator?.teamDetail } as any);
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
      const uploadsDir = path.resolve(process.cwd(), 'server/uploads');
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
    const uploadsDir = path.resolve(process.cwd(), 'server/uploads');
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

// Requests (e-approval)
apiRouter.post('/requests', (req, res) => {
  const schema = z.object({ kind: z.enum(['mold_change', 'material_add', 'maintenance', 'other']), details: z.string().min(1), createdBy: z.string().uuid() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const creator = repo.findUserById(parsed.data.createdBy);
  const it = repo.createRequest({ ...parsed.data, site: creator?.site, team: creator?.team, teamDetail: creator?.teamDetail } as any); notify('request:new', it); res.status(201).json(it);
});
apiRouter.get('/requests', (req, res) => {
  const filter = {
    site: typeof req.query.site === 'string' ? req.query.site : undefined,
    team: typeof req.query.team === 'string' ? req.query.team : undefined,
    teamDetail: typeof req.query.teamDetail === 'string' ? req.query.teamDetail : undefined,
  };
  res.json(repo.listRequests(filter));
});
apiRouter.patch('/requests/:id/approve', requireRole('manager','admin'), (req, res) => {
  const schema = z.object({ reviewerId: z.string().uuid() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const existing = repo.getRequestById(req.params.id); if (!existing) return res.sendStatus(404);
  if (existing.site && req.auth?.site && existing.site !== req.auth.site) return res.status(403).json({ error: 'Forbidden: cross-site' });
  const it = repo.setRequestState(req.params.id, 'approved', parsed.data.reviewerId); if (!it) return res.sendStatus(404); notify('request:approved', it); res.json(it);
});
apiRouter.patch('/requests/:id/reject', requireRole('manager','admin'), (req, res) => {
  const schema = z.object({ reviewerId: z.string().uuid() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const existing = repo.getRequestById(req.params.id); if (!existing) return res.sendStatus(404);
  if (existing.site && req.auth?.site && existing.site !== req.auth.site) return res.status(403).json({ error: 'Forbidden: cross-site' });
  const it = repo.setRequestState(req.params.id, 'rejected', parsed.data.reviewerId); if (!it) return res.sendStatus(404); notify('request:rejected', it); res.json(it);
});

// Announcements
apiRouter.post('/announcements', requireRole('manager','admin'), (req, res) => {
  const schema = z.object({ title: z.string().min(1), body: z.string().min(1), createdBy: z.string().uuid() });
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

// Suggestions
apiRouter.post('/suggestions', (req, res) => {
  const schema = z.object({ text: z.string().min(1), anonymous: z.boolean().default(true), createdBy: z.string().uuid().optional() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const it = repo.createSuggestion(parsed.data as any); notify('suggestion:new', it); res.status(201).json(it);
});
apiRouter.get('/suggestions', (_req, res) => { res.json(repo.listSuggestions()); });

// Leave requests
apiRouter.post('/leave-requests', (req, res) => {
  const schema = z.object({ userId: z.string().uuid(), startDate: z.string(), endDate: z.string(), reason: z.string().optional() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const lr = repo.createLeaveRequest(parsed.data as any); notify('leave:new', lr); res.status(201).json(lr);
});
apiRouter.get('/leave-requests', (_req, res) => { res.json(repo.listLeaveRequests()); });
apiRouter.patch('/leave-requests/:id/approve', requireRole('manager','admin'), (req, res) => {
  const schema = z.object({ reviewerId: z.string().uuid() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const it = repo.setLeaveState(req.params.id, 'approved', parsed.data.reviewerId); if (!it) return res.sendStatus(404); notify('leave:approved', it); res.json(it);
});
apiRouter.patch('/leave-requests/:id/reject', requireRole('manager','admin'), (req, res) => {
  const schema = z.object({ reviewerId: z.string().uuid() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const it = repo.setLeaveState(req.params.id, 'rejected', parsed.data.reviewerId); if (!it) return res.sendStatus(404); notify('leave:rejected', it); res.json(it);
});

// Schedule (CRUD)
apiRouter.get('/schedule', (_req, res) => { res.json(repo.listShifts()); });
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

// Uploads (base64 JSON)
apiRouter.post('/uploads/base64', (req, res) => {
  const schema = z.object({ filename: z.string().optional(), data: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { filename, data } = parsed.data;
  const m = /^data:(.*?);base64,(.*)$/.exec(data);
  const b64 = m ? m[2] : data;
  const ext = m ? (m[1]?.split('/')[1] || 'bin') : 'bin';
  const safeName = (filename && filename.replace(/[^a-zA-Z0-9_.-]/g, '')) || `upload_${Date.now()}.${ext}`;
  const uploadsDir = path.resolve(process.cwd(), 'server/uploads');
  const filePath = path.join(uploadsDir, safeName);
  try {
    fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
    const url = `/uploads/${safeName}`;
    auditLog(`UPLOAD OK ${safeName}`);
    res.status(201).json({ url });
  } catch (e) {
    auditLog(`UPLOAD FAIL ${safeName || 'unknown'} ${(e as any)?.message || ''}`);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Uploads (streaming, application/octet-stream)
// Usage: POST /api/uploads/stream?filename=foo.jpg with raw body, or send header x-filename
apiRouter.post('/uploads/stream', (req, res) => {
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
  const baseName = nameSrc || `upload_${Date.now()}.${ext}`;
  const uploadsDir = path.resolve(process.cwd(), 'server/uploads');
  const filePath = path.join(uploadsDir, baseName);

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
      const url = `/uploads/${baseName}`;
      auditLog(`STREAM OK ${baseName} ${written}b`);
      res.status(201).json({ url });
    });
    ws.on('error', (e) => {
      auditLog(`STREAM FAIL ${baseName} ${(e as any)?.message || ''}`);
      try { fs.unlinkSync(filePath); } catch {}
      res.status(500).json({ error: 'Failed to save file' });
    });
  } catch (e) {
    auditLog(`STREAM EXC ${baseName} ${(e as any)?.message || ''}`);
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
