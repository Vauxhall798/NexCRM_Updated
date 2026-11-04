import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { hashPassword, comparePassword } from '../lib/crypto-auth.ts';
import { z } from '../lib/validator.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth, signToken } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'MEMBER'] as const).optional().default('MEMBER'),
});

authRouter.post('/login', async (req: AuthRequest, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Invalid login input',
      details: parsed.error.flatten(),
    });
    return;
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  const token = signToken(authUser);

  res.json({ token, user: authUser });
});

authRouter.post('/register', async (req: AuthRequest, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Invalid registration data',
      details: parsed.error.flatten(),
    });
    return;
  }

  const { name, email, password, role } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    res.status(409).json({ error: 'A user with this email already exists' });
    return;
  }

  const password_hash = await hashPassword(password);
  const created = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password_hash,
      role,
    },
  });

  const authUser = {
    id: created.id,
    name: created.name,
    email: created.email,
    role: created.role,
  };
  const token = signToken(authUser);

  res.status(201).json({ token, user: authUser });
});

authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, created_at: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user });
});

authRouter.get('/users', requireAuth, async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, created_at: true },
    orderBy: { name: 'asc' },
  });
  res.json({ users });
});
