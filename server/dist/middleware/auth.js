import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
export function signToken(user) {
    const payload = { sub: user.id, role: user.role, name: user.name };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
export function requireAuth(req, res, next) {
    const h = req.headers['authorization'];
    if (!h || !h.startsWith('Bearer '))
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const token = h.slice('Bearer '.length);
        const decoded = jwt.verify(token, JWT_SECRET);
        req.auth = decoded;
        next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
export function requireRole(...roles) {
    return (req, res, next) => {
        const role = req.auth?.role;
        if (!role)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!roles.includes(role))
            return res.status(403).json({ error: 'Forbidden' });
        next();
    };
}
