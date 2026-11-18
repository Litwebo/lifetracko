import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pg } from './db.ts';

import { adminAuth } from '../src/lib/firebase-admin.ts';
import { getOrCreateUser } from '../src/db/users.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'lifetrack_super_secure_jwt_secret_key_2026_x89f';

export interface AuthUserPayload {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthUserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUserPayload;
  } catch (err) {
    return null;
  }
}

export function generateResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

export function generate4DigitCode(): string {
  // Generate random 4-digit OTP between 1000 and 9999
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  return code;
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

// In-memory rate limiter for sensitive endpoints like login & password reset
const rateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ipOrKey: string, maxAttempts = 6, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ipOrKey);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(ipOrKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false;
  }

  entry.count++;
  return true;
}

// Password validation rule
export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number.' };
  }
  return { valid: true };
}

// Authentication middleware
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.lifetrack_token) {
    token = req.cookies.lifetrack_token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  // Handle ephemeral demo member session (strictly Member role, never Admin)
  if (token === 'demo_member_session_token' || req.headers['x-demo-session'] === 'true') {
    req.user = {
      id: 'demo-member-ephemeral-session',
      name: 'Demo Member',
      email: 'demo.member@lifetracko.app',
      role: 'MEMBER',
    };
    return next();
  }

  const payload = verifyToken(token);
  if (payload) {
    // Check if user still exists and is ACTIVE
    try {
      const userRes = await pg.query(`SELECT id, name, email, role, status FROM users WHERE id = $1`, [payload.id]);
      if (userRes.rows.length === 0) {
        return res.status(401).json({ error: 'User account not found.' });
      }

      const dbUser = userRes.rows[0];
      if (dbUser.status === 'INACTIVE') {
        return res.status(403).json({ error: 'Your account has been deactivated. Please contact administrator.' });
      }

      req.user = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role as 'ADMIN' | 'MEMBER',
      };

      return next();
    } catch (err: any) {
      console.error('Auth verification error:', err);
      return res.status(500).json({ error: 'Internal authentication error.' });
    }
  }

  // Try Firebase ID Token verification
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = decodedToken.email || `${decodedToken.uid}@google.user`;
    const name = decodedToken.name || decodedToken.email?.split('@')[0] || 'User';

    const dbUser = await getOrCreateUser(decodedToken.uid, email, name);

    req.user = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role as 'ADMIN' | 'MEMBER',
    };

    return next();
  } catch (fbErr) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }
}

// Admin only middleware
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
}
