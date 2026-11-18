import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    uid?: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'MEMBER';
    firebaseUser?: DecodedIdToken;
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = decodedToken.email || `${decodedToken.uid}@google.user`;
    const name = decodedToken.name || decodedToken.email?.split('@')[0] || 'User';

    const dbUser = await getOrCreateUser(decodedToken.uid, email, name);

    req.user = {
      id: dbUser.id,
      uid: decodedToken.uid,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as 'ADMIN' | 'MEMBER',
      firebaseUser: decodedToken,
    };
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
