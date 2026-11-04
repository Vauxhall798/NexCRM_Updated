import type { Request, Response, NextFunction } from '../lib/http-app.ts';
import { signJwt, verifyJwt } from '../lib/crypto-auth.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'nexcrm-local-dev-secret-key-2026';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function signToken(user: AuthUser): string {
  return signJwt(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    7
  );
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verifyJwt<AuthUser>(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin privileges are required for this action.' });
    return;
  }
  next();
}
