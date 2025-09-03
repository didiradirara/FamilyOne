import express from 'express';
import { z } from 'zod';
import { signToken } from '../middleware/auth.js';
import { repo } from '../repo.js';

export const authRouter = express.Router();

// Registration endpoint
authRouter.post('/register', (req, res) => {
  const siteSchema = z.enum(['hq','jeonju','busan']);
  const baseSchema = z.object({ name: z.string().min(1), role: z.enum(['worker','manager','admin']), site: siteSchema, team: z.string().min(1), teamDetail: z.string().optional() });
  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { name, role, site, team, teamDetail } = parsed.data;
  const ok = repo.validateTeam(site, team, teamDetail);
  if (!ok) return res.status(400).json({ error: 'Invalid team/site combination' });
  const user = repo.createUser(name, role, site, team, teamDetail);
  const token = signToken(user as any);
  res.status(201).json({ token, user });
});

// Login endpoint
authRouter.post('/login', (req, res) => {
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

export default authRouter;
