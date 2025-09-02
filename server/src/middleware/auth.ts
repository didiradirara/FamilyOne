import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import type { Role, User } from '../types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signToken(user: User): string {
  const payload = { sub: user.id, role: user.role, name: user.name, site: (user as any).site, team: (user as any).team, teamDetail: (user as any).teamDetail };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export interface AuthPayload { sub: string; role: Role; name: string; site?: string; team?: string; teamDetail?: string }

declare global {
  namespace Express {
    interface Request {
      user?: User;
      auth?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers['authorization'];
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const token = h.slice('Bearer '.length);
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.auth = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.auth?.role;
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
