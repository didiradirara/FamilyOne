import { notify } from '../realtime.js';
import express from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, signToken } from '../middleware/auth.js';
import { repo } from '../repo.js';
export const apiRouter = express.Router();
// Auth (unprotected)
apiRouter.post('/auth/register', (req, res) => {
    const schema = z.object({ name: z.string().min(1), role: z.enum(['worker', 'manager', 'admin']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const user = repo.createUser(parsed.data.name, parsed.data.role);
    const token = signToken(user);
    res.status(201).json({ token, user });
});
apiRouter.post('/auth/login', (req, res) => {
    console.log('[Auth] login request', req.body);
    const schema = z.object({ userId: z.string().uuid().optional(), name: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    let user;
    if (parsed.data.userId)
        user = repo.findUserById(parsed.data.userId);
    else if (parsed.data.name)
        user = repo.findUserByName(parsed.data.name);
    if (!user) {
        console.warn('[Auth] login failed: user not found', req.body);
        return res.status(404).json({ error: 'User not found' });
    }
    const token = signToken(user);
    console.log('[Auth] login success', { userId: user.id });
    res.json({ token, user });
});
// Protect everything below
apiRouter.use((req, res, next) => {
    if (req.path.startsWith('/auth'))
        return next();
    return requireAuth(req, res, next);
});
// Reports
apiRouter.post('/reports', (req, res) => {
    const schema = z.object({
        type: z.enum(['machine_fault', 'material_shortage', 'defect', 'other']),
        message: z.string().min(1),
        createdBy: z.string().uuid(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const report = repo.createReport(parsed.data);
    res.status(201).json(report);
});
apiRouter.get('/reports', (_req, res) => { res.json(repo.listReports()); });
apiRouter.patch('/reports/:id', requireRole('manager', 'admin'), (req, res) => {
    const schema = z.object({ status: z.enum(['new', 'ack', 'resolved']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const r = repo.updateReportStatus(req.params.id, parsed.data.status);
    if (!r)
        return res.sendStatus(404);
    res.json(r);
});
// Requests (e-approval)
apiRouter.post('/requests', (req, res) => {
    const schema = z.object({ kind: z.enum(['mold_change', 'material_add', 'maintenance', 'other']), details: z.string().min(1), createdBy: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const it = repo.createRequest(parsed.data);
    notify('request:new', it);
    res.status(201).json(it);
});
apiRouter.get('/requests', (_req, res) => { res.json(repo.listRequests()); });
apiRouter.patch('/requests/:id/approve', requireRole('manager', 'admin'), (req, res) => {
    const schema = z.object({ reviewerId: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const it = repo.setRequestState(req.params.id, 'approved', parsed.data.reviewerId);
    if (!it)
        return res.sendStatus(404);
    notify('request:approved', it);
    res.json(it);
});
apiRouter.patch('/requests/:id/reject', requireRole('manager', 'admin'), (req, res) => {
    const schema = z.object({ reviewerId: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const it = repo.setRequestState(req.params.id, 'rejected', parsed.data.reviewerId);
    if (!it)
        return res.sendStatus(404);
    notify('request:rejected', it);
    res.json(it);
});
// Announcements
apiRouter.post('/announcements', requireRole('manager', 'admin'), (req, res) => {
    const schema = z.object({ title: z.string().min(1), body: z.string().min(1), createdBy: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const ann = repo.createAnnouncement(parsed.data);
    notify('announcement:new', ann);
    res.status(201).json(ann);
});
apiRouter.get('/announcements', (_req, res) => { res.json(repo.listAnnouncements()); });
apiRouter.post('/announcements/:id/read', (req, res) => {
    const schema = z.object({ userId: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const ann = repo.markAnnouncementRead(req.params.id, parsed.data.userId);
    if (!ann)
        return res.sendStatus(404);
    notify('announcement:read', ann);
    res.json(ann);
});
// Checklists
apiRouter.get('/checklists/templates/:category', (req, res) => {
    const cat = req.params.category;
    if (cat !== 'safety' && cat !== 'quality')
        return res.sendStatus(404);
    res.json(repo.getChecklistTemplates(cat));
});
apiRouter.post('/checklists/submit', (req, res) => {
    const schema = z.object({
        date: z.string().min(8), userId: z.string().uuid(), category: z.enum(['safety', 'quality']),
        items: z.array(z.object({ id: z.string(), category: z.enum(['safety', 'quality']), title: z.string(), checked: z.boolean() }))
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const sub = repo.submitChecklist(parsed.data);
    notify('checklist:submitted', sub);
    res.status(201).json(sub);
});
// Suggestions
apiRouter.post('/suggestions', (req, res) => {
    const schema = z.object({ text: z.string().min(1), anonymous: z.boolean().default(true), createdBy: z.string().uuid().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const it = repo.createSuggestion(parsed.data);
    notify('suggestion:new', it);
    res.status(201).json(it);
});
apiRouter.get('/suggestions', (_req, res) => { res.json(repo.listSuggestions()); });
// Leave requests
apiRouter.post('/leave-requests', (req, res) => {
    const schema = z.object({ userId: z.string().uuid(), startDate: z.string(), endDate: z.string(), reason: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const lr = repo.createLeaveRequest(parsed.data);
    notify('leave:new', lr);
    res.status(201).json(lr);
});
apiRouter.get('/leave-requests', (_req, res) => { res.json(repo.listLeaveRequests()); });
apiRouter.patch('/leave-requests/:id/approve', requireRole('manager', 'admin'), (req, res) => {
    const schema = z.object({ reviewerId: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const it = repo.setLeaveState(req.params.id, 'approved', parsed.data.reviewerId);
    if (!it)
        return res.sendStatus(404);
    notify('leave:approved', it);
    res.json(it);
});
apiRouter.patch('/leave-requests/:id/reject', requireRole('manager', 'admin'), (req, res) => {
    const schema = z.object({ reviewerId: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const it = repo.setLeaveState(req.params.id, 'rejected', parsed.data.reviewerId);
    if (!it)
        return res.sendStatus(404);
    notify('leave:rejected', it);
    res.json(it);
});
// Schedule (placeholder)
apiRouter.get('/schedule', (_req, res) => { res.json([]); });
