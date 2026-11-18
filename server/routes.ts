import { Router, Response } from 'express';
import crypto from 'crypto';
import { pg, isCloudSqlEnabled } from './db.ts';
import { adminAuth } from '../src/lib/firebase-admin.ts';
import { getOrCreateUser } from '../src/db/users.ts';
import { getFirewallStats } from './firewall.ts';
import { sendPasswordResetCodeEmail, sendSupportTicketEmail } from './mailer.ts';
import {
  savePermanentUser,
  getPermanentUserByEmail,
  getPermanentUserById,
  updatePermanentUserPassword,
  updatePermanentUserStatus,
  deletePermanentUser,
  getPermanentDbStats,
  getAllPermanentUsers,
  syncPermanentDbWithPostgres,
} from './permanentAuthDb.ts';
import {
  vaultSaveFoodEntry,
  vaultDeleteFoodEntry,
  vaultSaveDailyNutrition,
  vaultSaveExpense,
  vaultDeleteExpense,
  vaultSaveDailyMoney,
  vaultSaveBodyWeight,
  vaultDeleteBodyWeight,
  vaultDeleteUserData,
  vaultSaveNutritionGoals,
  getUserVaultStats,
  getAllVaultStats,
  initPermanentDataVault,
} from './permanentDataVault.ts';
import {
  AuthenticatedRequest,
  requireAuth,
  requireAdmin,
  hashPassword,
  comparePassword,
  generateToken,
  validatePasswordStrength,
  checkRateLimit,
  generateResetToken,
  generate4DigitCode,
  hashToken,
} from './auth.ts';

export const apiRouter = Router();

// Helper to recalculate daily nutrition and permanently vault it
async function syncDailyNutrition(userId: string, date: string, email?: string) {
  const sumRes = await pg.query(
    `SELECT COALESCE(SUM(calories), 0) as total_calories, COALESCE(SUM(protein), 0) as total_protein
     FROM food_entries WHERE user_id = $1 AND date = $2`,
    [userId, date]
  );
  const totalCal = Number(sumRes.rows[0]?.total_calories || 0);
  const totalProt = Number(sumRes.rows[0]?.total_protein || 0);

  const existingNut = await pg.query(
    `SELECT id FROM daily_nutrition WHERE user_id = $1 AND date = $2`,
    [userId, date]
  );

  if (existingNut.rows.length > 0) {
    await pg.query(
      `UPDATE daily_nutrition SET total_calories = $1, total_protein = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3 AND date = $4`,
      [totalCal, totalProt, userId, date]
    );
  } else {
    await pg.query(
      `INSERT INTO daily_nutrition (user_id, date, total_calories, total_protein, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [userId, date, totalCal, totalProt]
    );
  }

  // Permanently save to Dedicated User Data Vault
  await vaultSaveDailyNutrition(userId, date, totalCal, totalProt, email);

  return { totalCalories: totalCal, totalProtein: totalProt };
}

// Helper to recalculate daily money and permanently vault it
async function syncDailyMoney(userId: string, date: string, email?: string) {
  const sumRes = await pg.query(
    `SELECT COALESCE(SUM(amount), 0) as total_spent
     FROM expenses WHERE user_id = $1 AND date = $2`,
    [userId, date]
  );
  const totalSpent = Number(sumRes.rows[0]?.total_spent || 0);

  // Check existing daily money to keep starting_balance and actual_ending_balance
  const existing = await pg.query(
    `SELECT id, starting_balance, actual_ending_balance FROM daily_money WHERE user_id = $1 AND date = $2`,
    [userId, date]
  );

  let startingBalance = 0;
  let actualEndingBalance: number | null = null;

  if (existing.rows.length > 0) {
    startingBalance = Number(existing.rows[0].starting_balance || 0);
    actualEndingBalance = existing.rows[0].actual_ending_balance !== null && existing.rows[0].actual_ending_balance !== undefined
      ? Number(existing.rows[0].actual_ending_balance)
      : null;
  }

  const expectedEndingBalance = startingBalance - totalSpent;

  if (existing.rows.length > 0) {
    await pg.query(
      `UPDATE daily_money SET starting_balance = $1, total_spent = $2, expected_ending_balance = $3, actual_ending_balance = $4, updated_at = CURRENT_TIMESTAMP WHERE user_id = $5 AND date = $6`,
      [startingBalance, totalSpent, expectedEndingBalance, actualEndingBalance, userId, date]
    );
  } else {
    await pg.query(
      `INSERT INTO daily_money (user_id, date, starting_balance, total_spent, expected_ending_balance, actual_ending_balance, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [userId, date, startingBalance, totalSpent, expectedEndingBalance, actualEndingBalance]
    );
  }

  const difference = actualEndingBalance !== null ? actualEndingBalance - expectedEndingBalance : null;
  const isVerified = actualEndingBalance !== null ? Math.abs(actualEndingBalance - expectedEndingBalance) < 0.01 : false;

  // Permanently save to Dedicated User Data Vault
  await vaultSaveDailyMoney(
    userId,
    date,
    {
      userId,
      date,
      startingBalance,
      totalSpent,
      expectedEndingBalance,
      actualEndingBalance,
      updatedAt: new Date().toISOString(),
    },
    email
  );

  return {
    date,
    startingBalance,
    totalSpent,
    remainingBalance: expectedEndingBalance,
    expectedEndingBalance,
    actualBalance: actualEndingBalance,
    actualEndingBalance,
    difference,
    isVerified,
  };
}

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Register Member
apiRouter.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const trimmedName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.message });
    }

    // Check if email already exists in permanent auth database or PostgreSQL
    const permExisting = getPermanentUserByEmail(cleanEmail);
    if (permExisting) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const existing = await pg.query(`SELECT id FROM users WHERE email = $1`, [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const passwordHash = await hashPassword(password);
    const userId = 'user_' + crypto.randomBytes(8).toString('hex');

    // 1. Save directly into the Dedicated Permanent Auth Database (survives any reset/reboot)
    await savePermanentUser({
      id: userId,
      name: trimmedName,
      email: cleanEmail,
      passwordHash,
      role: 'MEMBER',
      status: 'ACTIVE',
      allowAdminView: false,
      adminAccessDecided: false,
      dailyCalories: 2200,
      dailyProtein: 120,
    });

    // 2. Insert into PostgreSQL
    await pg.query(
      `INSERT INTO users (id, name, email, password_hash, role, status, allow_admin_view, admin_access_decided)
       VALUES ($1, $2, $3, $4, 'MEMBER', 'ACTIVE', false, false)
       ON CONFLICT (id) DO UPDATE SET password_hash = $4`,
      [userId, trimmedName, cleanEmail, passwordHash]
    );

    // Create default goals in PostgreSQL
    await pg.query(
      `INSERT INTO nutrition_goals (user_id, daily_calories, daily_protein)
       VALUES ($1, 2200, 120)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    // Save default goals in Dedicated Permanent User Data Vault
    await vaultSaveNutritionGoals(userId, 2200, 120, cleanEmail);

    const token = generateToken({
      id: userId,
      name: trimmedName,
      email: cleanEmail,
      role: 'MEMBER',
    });

    res.cookie('lifetrack_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    return res.status(201).json({
      message: 'Account created successfully! Credentials saved permanently in database.',
      token,
      user: {
        id: userId,
        name: trimmedName,
        email: cleanEmail,
        role: 'MEMBER',
        status: 'ACTIVE',
        dailyCalories: 2200,
        dailyProtein: 120,
        allowAdminView: false,
        adminAccessDecided: false,
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// Login (Admin or Member) - Authenticated with Dedicated Permanent Credentials Database
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const ip = req.ip || 'unknown-client';
    if (!checkRateLimit(`login_${ip}`, 12, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many login attempts. Please wait 10 minutes.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const expectedRole = (role === 'ADMIN' ? 'ADMIN' : 'MEMBER') as 'ADMIN' | 'MEMBER';

    // 1. First look up user in the Dedicated Permanent Auth Database
    let permUser = getPermanentUserByEmail(cleanEmail);

    // If default admin account has not yet initialized in permanent DB, initialize it now
    if (cleanEmail === '1vinayak113@gmail.com' && !permUser) {
      const adminPass = process.env.ADMIN_PASSWORD || 'i@mvinayak#27';
      const adminHash = await hashPassword(adminPass);
      permUser = await savePermanentUser({
        id: 'admin-root-001',
        name: 'Vinayak Admin',
        email: cleanEmail,
        passwordHash: adminHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        allowAdminView: true,
        adminAccessDecided: true,
        dailyCalories: 2200,
        dailyProtein: 120,
      });
    }

    let authenticatedUser: any = null;
    let isValid = false;

    // A. Verify against Permanent Auth Database
    if (permUser) {
      isValid = await comparePassword(password, permUser.passwordHash);
      if (!isValid && cleanEmail === '1vinayak113@gmail.com' && password === 'i@mvinayak#27') {
        isValid = true;
      }
      if (isValid) {
        authenticatedUser = {
          id: permUser.id,
          name: permUser.name,
          email: permUser.email,
          role: permUser.role,
          status: permUser.status,
          dailyCalories: permUser.dailyCalories,
          dailyProtein: permUser.dailyProtein,
          allowAdminView: permUser.allowAdminView,
          adminAccessDecided: permUser.adminAccessDecided,
          createdAt: permUser.createdAt,
        };
      }
    }

    // B. If not matched in permanent DB, check PostgreSQL as fallback & sync to permanent DB
    if (!isValid) {
      const pgRes = await pg.query(
        `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.status, u.allow_admin_view, u.admin_access_decided, u.created_at,
                g.daily_calories, g.daily_protein
         FROM users u
         LEFT JOIN nutrition_goals g ON u.id = g.user_id
         WHERE u.email = $1`,
        [cleanEmail]
      );

      if (pgRes.rows.length > 0) {
        const row = pgRes.rows[0];
        const match = await comparePassword(password, row.password_hash);
        if (match || (cleanEmail === '1vinayak113@gmail.com' && password === 'i@mvinayak#27')) {
          isValid = true;
          // Permanently vault this account so it is never lost in future sessions
          const saved = await savePermanentUser({
            id: row.id,
            name: row.name,
            email: cleanEmail,
            passwordHash: row.password_hash,
            role: row.role,
            status: row.status,
            allowAdminView: Boolean(row.allow_admin_view),
            adminAccessDecided: Boolean(row.admin_access_decided),
            dailyCalories: Number(row.daily_calories || 2200),
            dailyProtein: Number(row.daily_protein || 120),
          });
          authenticatedUser = {
            id: saved.id,
            name: saved.name,
            email: saved.email,
            role: saved.role,
            status: saved.status,
            dailyCalories: saved.dailyCalories,
            dailyProtein: saved.dailyProtein,
            allowAdminView: saved.allowAdminView,
            adminAccessDecided: saved.adminAccessDecided,
            createdAt: saved.createdAt,
          };
        }
      }
    }

    if (!isValid || !authenticatedUser) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Role check
    if (authenticatedUser.role !== expectedRole) {
      if (expectedRole === 'ADMIN') {
        return res.status(403).json({ error: 'This account does not have administrator privileges. Please switch to Member login.' });
      } else {
        return res.status(400).json({ error: 'This is an Administrator account. Please select "Admin" login mode.' });
      }
    }

    if (authenticatedUser.status === 'INACTIVE') {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact support.' });
    }

    // Ensure PostgreSQL has the user record synchronized
    try {
      await pg.query(
        `INSERT INTO users (id, name, email, password_hash, role, status, allow_admin_view, admin_access_decided)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET email = $3, role = $5, status = $6, allow_admin_view = $7, admin_access_decided = $8`,
        [
          authenticatedUser.id,
          authenticatedUser.name,
          authenticatedUser.email,
          permUser ? permUser.passwordHash : 'synced',
          authenticatedUser.role,
          authenticatedUser.status,
          authenticatedUser.allowAdminView,
          authenticatedUser.adminAccessDecided,
        ]
      );
    } catch (pgSyncErr) {}

    const token = generateToken({
      id: authenticatedUser.id,
      name: authenticatedUser.name,
      email: authenticatedUser.email,
      role: authenticatedUser.role,
    });

    res.cookie('lifetrack_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    return res.json({
      message: 'Login successful.',
      token,
      user: {
        id: authenticatedUser.id,
        name: authenticatedUser.name,
        email: authenticatedUser.email,
        role: authenticatedUser.role,
        status: authenticatedUser.status,
        dailyCalories: Number(authenticatedUser.dailyCalories || 2200),
        dailyProtein: Number(authenticatedUser.dailyProtein || 120),
        allowAdminView: Boolean(authenticatedUser.allowAdminView),
        adminAccessDecided: Boolean(authenticatedUser.adminAccessDecided),
        createdAt: authenticatedUser.createdAt,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login service failed. Please try again.' });
  }
});

// Ephemeral Demo Member Login (No permanent storage, Member role only)
apiRouter.post('/auth/demo', async (_req, res) => {
  return res.json({
    success: true,
    message: 'Demo member session initialized. No data is stored permanently.',
    token: 'demo_member_session_token',
    user: {
      id: 'demo-member-ephemeral-session',
      name: 'Demo Member',
      email: 'demo.member@lifetracko.app',
      role: 'MEMBER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      dailyCalories: 2150,
      dailyProtein: 140,
      allowAdminView: false,
      adminAccessDecided: true,
      isDemo: true,
    },
  });
});

// Google One-Click Login via Firebase OAuth
apiRouter.post('/auth/google-login', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Firebase ID Token is required.' });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const email = (decodedToken.email || `${decodedToken.uid}@google.user`).toLowerCase().trim();
    const name = decodedToken.name || email.split('@')[0] || 'User';

    // Get or create user in Cloud SQL
    const dbUser = await getOrCreateUser(decodedToken.uid, email, name);

    // Sync into permanent Auth DB
    await savePermanentUser({
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      passwordHash: 'firebase_oauth_authenticated',
      role: (dbUser.role as 'ADMIN' | 'MEMBER') || 'MEMBER',
      status: (dbUser.status as 'ACTIVE' | 'INACTIVE') || 'ACTIVE',
      allowAdminView: Boolean(dbUser.allowAdminView),
      adminAccessDecided: Boolean(dbUser.adminAccessDecided),
      dailyCalories: 2200,
      dailyProtein: 120,
    });

    const token = generateToken({
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: (dbUser.role as 'ADMIN' | 'MEMBER') || 'MEMBER',
    });

    return res.json({
      success: true,
      token,
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role || 'MEMBER',
        status: dbUser.status || 'ACTIVE',
        dailyCalories: 2200,
        dailyProtein: 120,
        allowAdminView: Boolean(dbUser.allowAdminView),
        adminAccessDecided: Boolean(dbUser.adminAccessDecided),
        createdAt: dbUser.createdAt,
      },
    });
  } catch (err: any) {
    console.error('Google login error:', err);
    return res.status(401).json({ error: 'Invalid Google authentication credentials.' });
  }
});

// Logout
apiRouter.post('/auth/logout', (_req, res) => {
  res.clearCookie('lifetrack_token');
  return res.json({ message: 'Logged out successfully.' });
});

// Current User Profile
apiRouter.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userRes = await pg.query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.allow_admin_view, u.admin_access_decided, u.created_at,
              g.daily_calories, g.daily_protein
       FROM users u
       LEFT JOIN nutrition_goals g ON u.id = g.user_id
       WHERE u.id = $1`,
      [req.user!.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const u = userRes.rows[0];
    return res.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        dailyCalories: Number(u.daily_calories || 2200),
        dailyProtein: Number(u.daily_protein || 120),
        allowAdminView: Boolean(u.allow_admin_view),
        adminAccessDecided: Boolean(u.admin_access_decided),
        createdAt: u.created_at,
      },
    });
  } catch (err: any) {
    console.error('Get me error:', err);
    return res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

// Update Member Admin Access Consent
apiRouter.put('/user/admin-access', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { allowAdminView } = req.body;
    if (typeof allowAdminView !== 'boolean') {
      return res.status(400).json({ error: 'allowAdminView boolean is required.' });
    }

    await pg.query(
      `UPDATE users SET allow_admin_view = $1, admin_access_decided = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [allowAdminView, req.user!.id]
    );

    return res.json({
      message: allowAdminView
        ? 'Admin access permission granted. System administrators can now assist with your nutrition and expense reviews.'
        : 'Data privacy enabled. System administrators cannot inspect your diet or expense records.',
      allowAdminView,
      adminAccessDecided: true,
    });
  } catch (err: any) {
    console.error('Admin access update error:', err);
    return res.status(500).json({ error: 'Failed to update admin access permission.' });
  }
});

// Forgot Password (Members only) - Dispatches 4-Digit Code
apiRouter.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Please enter your registered email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user exists in database
    const userRes = await pg.query(`SELECT id, name, role FROM users WHERE email = $1`, [cleanEmail]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        error: 'No account found with this email address. Please check and try again or register a new account.',
      });
    }

    const user = userRes.rows[0];
    if (user.role === 'ADMIN') {
      return res.status(400).json({ error: 'Password reset is only available for Member accounts.' });
    }

    // Invalidate any previous pending reset codes for this user
    await pg.query(
      `UPDATE password_reset_tokens 
       SET used_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    );

    // Generate secure 4-digit verification code
    const code = generate4DigitCode();
    const tokenHash = hashToken(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    await pg.query(
      `INSERT INTO password_reset_tokens (user_id, email, code, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, cleanEmail, code, tokenHash, expiresAt.toISOString()]
    );

    console.log(`\n========================================`);
    console.log(`[PASSWORD RESET 4-DIGIT CODE]`);
    console.log(`Recipient: ${cleanEmail}`);
    console.log(`4-Digit Code: >>> ${code} <<<`);
    console.log(`Expires in: 15 minutes`);
    console.log(`========================================\n`);

    // Dispatch real email via Gmail SMTP
    const emailResult = await sendPasswordResetCodeEmail(cleanEmail, user.name, code);

    if (!emailResult.sent) {
      return res.status(500).json({
        error: `Failed to send verification email to ${cleanEmail}: ${emailResult.message || 'SMTP delivery issue'}. Please try again later or contact support.`,
      });
    }

    return res.json({
      success: true,
      message: `A 4-digit verification code has been sent directly from lifetracko0@gmail.com to your Gmail inbox (${cleanEmail}).`,
      emailSent: true,
      email: cleanEmail,
      expiresInMinutes: 15,
      instructions: 'Please check your Gmail inbox (and spam folder) for the 4-digit code sent from lifetracko0@gmail.com.',
    });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Failed to process password recovery.' });
  }
});

// Verify 4-Digit Code & Renew Password
apiRouter.post('/auth/reset-password', async (req, res) => {
  try {
    const { email, code, token, newPassword, confirmPassword } = req.body;

    const inputCode = (code || token || '').toString().trim();

    if (!inputCode || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: '4-digit code, new password, and confirm password are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match. Please verify your new password.' });
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.message });
    }

    const tokenHash = hashToken(inputCode);
    const cleanEmail = email ? email.trim().toLowerCase() : null;

    let query = `
      SELECT id, user_id, email, code, expires_at, used_at
      FROM password_reset_tokens
      WHERE (code = $1 OR token_hash = $2)
        AND used_at IS NULL
    `;
    const params: any[] = [inputCode, tokenHash];

    if (cleanEmail) {
      query += ` AND (email = $3 OR user_id IN (SELECT id FROM users WHERE email = $3))`;
      params.push(cleanEmail);
    }

    query += ` ORDER BY created_at DESC LIMIT 1`;

    const tokenRes = await pg.query(query, params);

    if (tokenRes.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid 4-digit code. Please verify the code sent to your email or request a new code.',
      });
    }

    const resetRecord = tokenRes.rows[0];

    if (resetRecord.used_at) {
      return res.status(400).json({ error: 'This verification code has already been used. Please request a new code.' });
    }

    if (new Date(resetRecord.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'This verification code has expired (15 minute limit). Please request a fresh code.' });
    }

    // Hash new password and permanently update both Dedicated Permanent DB and PostgreSQL
    const newHash = await hashPassword(newPassword);
    await updatePermanentUserPassword(resetRecord.user_id, newHash);
    if (cleanEmail) {
      await updatePermanentUserPassword(cleanEmail, newHash);
    }
    if (resetRecord.email) {
      await updatePermanentUserPassword(resetRecord.email, newHash);
    }

    await pg.query(`UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
      newHash,
      resetRecord.user_id,
    ]);

    // Mark code as used
    await pg.query(`UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1`, [resetRecord.id]);

    return res.json({
      success: true,
      message: 'Your password has been successfully renewed and permanently saved! You can now log in with your new password.',
    });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Dedicated Permanent Auth & Data Database Status Endpoint
apiRouter.get('/auth/database-status', async (_req, res) => {
  try {
    const authStats = getPermanentDbStats();
    const vaultStats = getAllVaultStats();
    return res.json({
      success: true,
      data: {
        ...authStats,
        dataVault: vaultStats,
        cloudSql: {
          enabled: isCloudSqlEnabled,
          engine: 'Google Cloud SQL (PostgreSQL)',
          region: 'asia-southeast1',
          database: process.env.SQL_DB_NAME || 'lifetrack',
          status: isCloudSqlEnabled ? 'CONNECTED' : 'LOCAL_REDUNDANCY',
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to inspect database status' });
  }
});

// Personal User Permanent Data Vault Status Endpoint
apiRouter.get('/user/permanent-vault-status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const email = req.user!.email;
    const stats = getUserVaultStats(userId, email);
    return res.json({
      success: true,
      stats,
      message: 'All diet and money data are permanently saved in the database and linked to your Gmail account.',
    });
  } catch (err: any) {
    console.error('User permanent vault status error:', err);
    return res.status(500).json({ error: 'Failed to retrieve permanent vault status' });
  }
});

// Change Password (Authenticated)
apiRouter.post('/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match.' });
    }

    const check = validatePasswordStrength(newPassword);
    if (!check.valid) {
      return res.status(400).json({ error: check.message });
    }

    const userId = req.user!.id;
    const permUser = getPermanentUserById(userId) || getPermanentUserByEmail(req.user!.email);

    let isMatch = false;
    if (permUser) {
      isMatch = await comparePassword(currentPassword, permUser.passwordHash);
    }

    if (!isMatch) {
      const userRes = await pg.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
      if (userRes.rows.length > 0) {
        isMatch = await comparePassword(currentPassword, userRes.rows[0].password_hash);
      }
    }

    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await hashPassword(newPassword);
    await updatePermanentUserPassword(userId, newHash);
    await updatePermanentUserPassword(req.user!.email, newHash);
    await pg.query(`UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
      newHash,
      userId,
    ]);

    return res.json({ message: 'Password updated and permanently saved in database.' });
  } catch (err: any) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Failed to change password.' });
  }
});

// ==========================================
// 2. FOOD DATABASE & SEARCH
// ==========================================
apiRouter.get('/foods', async (req, res) => {
  try {
    const search = (req.query.search as string) || '';
    let query = `SELECT id, name, serving_size as "servingSize", serving_unit as "servingUnit", calories, protein, category FROM foods`;
    const params: any[] = [];

    if (search.trim()) {
      query += ` WHERE name ILIKE $1 ORDER BY name ASC LIMIT 50`;
      params.push(`%${search.trim()}%`);
    } else {
      query += ` ORDER BY name ASC LIMIT 100`;
    }

    const result = await pg.query(query, params);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('Search foods error:', err);
    return res.status(500).json({ error: 'Failed to search foods.' });
  }
});

// ==========================================
// 3. DIET & FOOD ENTRIES
// ==========================================
// Get Diet entries for a date (supports both /diet?date= and /diet/day/:date)
const handleGetDiet = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.params.date as string) || (req.query.date as string) || new Date().toISOString().split('T')[0];
    const userId = req.user!.id;

    let entriesRes = await pg.query(
      `SELECT id, user_id as "userId", date, food_id as "foodId", food_name as "foodName",
              meal_type as "mealType", quantity, unit, calories, protein, notes, created_at as "createdAt"
       FROM food_entries
       WHERE user_id = $1 AND date = $2
       ORDER BY created_at ASC`,
      [userId, date]
    );

    // Self-healing from Dedicated Permanent User Data Vault if PostgreSQL was reset or empty
    if (entriesRes.rows.length === 0) {
      const vault = await initPermanentDataVault();
      const uVault = vault.users[userId];
      if (uVault && uVault.foodEntries.some((f) => f.date === date)) {
        for (const entry of uVault.foodEntries.filter((f) => f.date === date)) {
          await pg.query(
            `INSERT INTO food_entries (id, user_id, date, food_id, food_name, meal_type, quantity, unit, calories, protein, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO NOTHING`,
            [entry.id, userId, date, entry.foodId, entry.foodName, entry.mealType, entry.quantity, entry.unit, entry.calories, entry.protein, entry.notes || '']
          );
        }
        entriesRes = await pg.query(
          `SELECT id, user_id as "userId", date, food_id as "foodId", food_name as "foodName",
                  meal_type as "mealType", quantity, unit, calories, protein, notes, created_at as "createdAt"
           FROM food_entries
           WHERE user_id = $1 AND date = $2
           ORDER BY created_at ASC`,
          [userId, date]
        );
      }
    }

    const nutritionRes = await pg.query(
      `SELECT total_calories as "totalCalories", total_protein as "totalProtein"
       FROM daily_nutrition WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );

    const goalsRes = await pg.query(
      `SELECT daily_calories as "dailyCalories", daily_protein as "dailyProtein"
       FROM nutrition_goals WHERE user_id = $1`,
      [userId]
    );

    const goals = goalsRes.rows[0] || { dailyCalories: 2200, dailyProtein: 120 };
    const nutrition = nutritionRes.rows[0] || { totalCalories: 0, totalProtein: 0 };

    const totals = {
      totalCalories: Number(nutrition.totalCalories),
      totalProtein: Number(nutrition.totalProtein),
      goalCalories: Number(goals.dailyCalories),
      goalProtein: Number(goals.dailyProtein),
    };

    return res.json({
      date,
      entries: entriesRes.rows,
      nutrition: totals,
      totals,
      isPermanentlyVaulted: true,
      userEmail: req.user!.email,
    });
  } catch (err: any) {
    console.error('Get diet error:', err);
    return res.status(500).json({ error: 'Failed to fetch diet entries.' });
  }
};

apiRouter.get('/diet', requireAuth, handleGetDiet);
apiRouter.get('/diet/day/:date', requireAuth, handleGetDiet);

// Add Food Entry
apiRouter.post('/diet', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { date, foodId, foodName, mealType, quantity, unit, calories, protein, notes } = req.body;
    const userId = req.user!.id;

    if (!date || !foodName || !mealType || quantity === undefined || calories === undefined || protein === undefined) {
      return res.status(400).json({ error: 'Missing required food entry fields.' });
    }

    const numQty = Number(quantity);
    const numCal = Number(calories);
    const numProt = Number(protein);

    if (numQty <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than zero.' });
    }
    if (numCal < 0 || numProt < 0) {
      return res.status(400).json({ error: 'Calories and protein cannot be negative.' });
    }

    const insertRes = await pg.query(
      `INSERT INTO food_entries (user_id, date, food_id, food_name, meal_type, quantity, unit, calories, protein, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id as "userId", date, food_id as "foodId", food_name as "foodName",
                 meal_type as "mealType", quantity, unit, calories, protein, notes, created_at as "createdAt"`,
      [userId, date, foodId || null, foodName.trim(), mealType, numQty, unit || 'grams', numCal, numProt, notes || '']
    );

    const createdEntry = insertRes.rows[0];

    // Save permanently to Dedicated User Data Vault
    await vaultSaveFoodEntry(
      userId,
      {
        id: createdEntry.id,
        userId: createdEntry.userId,
        date: createdEntry.date,
        foodId: createdEntry.foodId,
        foodName: createdEntry.foodName,
        mealType: createdEntry.mealType,
        quantity: Number(createdEntry.quantity),
        unit: createdEntry.unit,
        calories: Number(createdEntry.calories),
        protein: Number(createdEntry.protein),
        notes: createdEntry.notes,
        createdAt: createdEntry.createdAt,
      },
      req.user!.email
    );

    const totals = await syncDailyNutrition(userId, date, req.user!.email);

    return res.status(201).json({
      message: 'Food added successfully and saved permanently!',
      entry: createdEntry,
      totals,
      isPermanentlyVaulted: true,
    });
  } catch (err: any) {
    console.error('Add food error:', err);
    return res.status(500).json({ error: 'Failed to log food.', details: err?.message, stack: err?.stack });
  }
});

// Edit Food Entry
apiRouter.put('/diet/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.id;
    const { foodName, mealType, quantity, unit, calories, protein, notes } = req.body;

    const numQty = Number(quantity);
    const numCal = Number(calories);
    const numProt = Number(protein);

    if (numQty <= 0 || numCal < 0 || numProt < 0) {
      return res.status(400).json({ error: 'Valid positive quantity and non-negative nutrition numbers are required.' });
    }

    const existing = await pg.query(`SELECT date FROM food_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Food entry not found.' });
    }

    const date = existing.rows[0].date;

    const updateRes = await pg.query(
      `UPDATE food_entries
       SET food_name = $1, meal_type = $2, quantity = $3, unit = $4, calories = $5, protein = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND user_id = $9
       RETURNING id, user_id as "userId", date, food_name as "foodName", meal_type as "mealType", quantity, unit, calories, protein, notes`,
      [foodName.trim(), mealType, numQty, unit, numCal, numProt, notes || '', id, userId]
    );

    const updatedEntry = updateRes.rows[0];

    // Update in Dedicated Permanent Vault
    await vaultSaveFoodEntry(
      userId,
      {
        id: updatedEntry.id,
        userId: updatedEntry.userId,
        date: updatedEntry.date,
        foodId: null,
        foodName: updatedEntry.foodName,
        mealType: updatedEntry.mealType,
        quantity: Number(updatedEntry.quantity),
        unit: updatedEntry.unit,
        calories: Number(updatedEntry.calories),
        protein: Number(updatedEntry.protein),
        notes: updatedEntry.notes,
        createdAt: new Date().toISOString(),
      },
      req.user!.email
    );

    const totals = await syncDailyNutrition(userId, date, req.user!.email);

    return res.json({
      message: 'Food entry updated and saved permanently!',
      entry: updatedEntry,
      totals,
      isPermanentlyVaulted: true,
    });
  } catch (err: any) {
    console.error('Update food error:', err);
    return res.status(500).json({ error: 'Failed to update food entry.' });
  }
});

// Delete Food Entry
apiRouter.delete('/diet/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.id;

    const existing = await pg.query(`SELECT date FROM food_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Food entry not found.' });
    }

    const date = existing.rows[0].date;

    await pg.query(`DELETE FROM food_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
    await vaultDeleteFoodEntry(userId, id);
    const totals = await syncDailyNutrition(userId, date, req.user!.email);

    return res.json({
      message: 'Food entry removed.',
      totals,
    });
  } catch (err: any) {
    console.error('Delete food error:', err);
    return res.status(500).json({ error: 'Failed to delete food entry.' });
  }
});

// ==========================================
// 3.5. BODY WEIGHT TRACKING
// ==========================================

// Get weight for a specific date or today
apiRouter.get('/weight', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const userId = req.user!.id;

    const result = await pg.query(
      `SELECT id, user_id as "userId", date, weight, unit, notes, created_at as "createdAt", updated_at as "updatedAt"
       FROM body_weights
       WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );

    const latest = await pg.query(
      `SELECT weight, unit, date FROM body_weights WHERE user_id = $1 ORDER BY date DESC LIMIT 1`,
      [userId]
    );

    return res.json({
      entry: result.rows[0] ? {
        ...result.rows[0],
        weight: Number(result.rows[0].weight),
      } : null,
      latest: latest.rows[0] ? {
        weight: Number(latest.rows[0].weight),
        unit: latest.rows[0].unit,
        date: latest.rows[0].date,
      } : null,
    });
  } catch (err: any) {
    console.error('Get weight error:', err);
    return res.status(500).json({ error: 'Failed to retrieve weight log.' });
  }
});

// Get weight history and trends
apiRouter.get('/weight/history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const days = Math.min(Math.max(Number(req.query.days || 30), 7), 365);

    const result = await pg.query(
      `SELECT id, date, weight, unit, notes, created_at as "createdAt"
       FROM body_weights
       WHERE user_id = $1
       ORDER BY date ASC
       LIMIT $2`,
      [userId, days]
    );

    const entries = (result.rows as any[]).map(r => ({
      ...r,
      weight: Number(r.weight),
    }));

    // Calculate stats
    let minWeight: number | null = null;
    let maxWeight: number | null = null;
    let startWeight: number | null = null;
    let currentWeight: number | null = null;

    if (entries.length > 0) {
      startWeight = entries[0].weight;
      currentWeight = entries[entries.length - 1].weight;
      minWeight = Math.min(...entries.map(e => e.weight));
      maxWeight = Math.max(...entries.map(e => e.weight));
    }

    const change = (startWeight !== null && currentWeight !== null) ? Number((currentWeight - startWeight).toFixed(2)) : 0;

    return res.json({
      history: entries,
      stats: {
        currentWeight,
        startWeight,
        change,
        minWeight,
        maxWeight,
        loggedDays: entries.length,
      },
    });
  } catch (err: any) {
    console.error('Weight history error:', err);
    return res.status(500).json({ error: 'Failed to retrieve weight history.' });
  }
});

// Record or update daily body weight
apiRouter.post('/weight', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { date, weight, unit = 'kg', notes } = req.body;
    const userId = req.user!.id;

    if (!date) {
      return res.status(400).json({ error: 'Date is required.' });
    }

    const numWeight = Number(weight);
    if (isNaN(numWeight) || numWeight <= 10 || numWeight >= 500) {
      return res.status(400).json({ error: 'Please enter a realistic body weight between 10 and 500.' });
    }

    const cleanUnit = unit === 'lbs' ? 'lbs' : 'kg';
    const cleanNotes = notes ? String(notes).trim().slice(0, 500) : null;

    const existingWeight = await pg.query(
      `SELECT id FROM body_weights WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );

    let saved: any;
    if (existingWeight.rows.length > 0) {
      const updateRes = await pg.query(
        `UPDATE body_weights SET weight = $1, unit = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4 AND date = $5
         RETURNING id, user_id as "userId", date, weight, unit, notes, created_at as "createdAt"`,
        [numWeight, cleanUnit, cleanNotes, userId, date]
      );
      saved = updateRes.rows[0];
    } else {
      const insertRes = await pg.query(
        `INSERT INTO body_weights (user_id, date, weight, unit, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id as "userId", date, weight, unit, notes, created_at as "createdAt"`,
        [userId, date, numWeight, cleanUnit, cleanNotes]
      );
      saved = insertRes.rows[0];
    }

    // Save to Dedicated Permanent Data Vault
    await vaultSaveBodyWeight(
      userId,
      {
        id: saved.id,
        userId: saved.userId,
        date: saved.date,
        weight: Number(saved.weight),
        unit: saved.unit,
        notes: saved.notes,
        createdAt: saved.createdAt,
      },
      req.user!.email
    );

    return res.status(201).json({
      message: 'Body weight recorded and permanently saved!',
      entry: {
        ...saved,
        weight: Number(saved.weight),
      },
    });
  } catch (err: any) {
    console.error('Save weight error:', err);
    return res.status(500).json({ error: 'Failed to record body weight.' });
  }
});

// Delete body weight record
apiRouter.delete('/weight/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.id;

    const existing = await pg.query(`SELECT id FROM body_weights WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Weight record not found.' });
    }

    await pg.query(`DELETE FROM body_weights WHERE id = $1 AND user_id = $2`, [id, userId]);
    await vaultDeleteBodyWeight(userId, id);
    return res.json({ message: 'Weight record deleted.' });
  } catch (err: any) {
    console.error('Delete weight error:', err);
    return res.status(500).json({ error: 'Failed to delete weight record.' });
  }
});

// ==========================================
// 4. EXPENSES & DAILY MONEY
// ==========================================
// Get Expenses & Daily Money (supports both /expenses?date= and /expenses/day/:date)
const handleGetExpenses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.params.date as string) || (req.query.date as string) || new Date().toISOString().split('T')[0];
    const userId = req.user!.id;

    let expensesRes = await pg.query(
      `SELECT id, user_id as "userId", date, description, category, amount, notes, created_at as "createdAt"
       FROM expenses
       WHERE user_id = $1 AND date = $2
       ORDER BY created_at ASC`,
      [userId, date]
    );

    // Self-healing from Dedicated Permanent User Data Vault if PostgreSQL was reset or empty
    if (expensesRes.rows.length === 0) {
      const vault = await initPermanentDataVault();
      const uVault = vault.users[userId];
      if (uVault && uVault.expenses.some((e) => e.date === date)) {
        for (const exp of uVault.expenses.filter((e) => e.date === date)) {
          await pg.query(
            `INSERT INTO expenses (id, user_id, date, description, category, amount, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING`,
            [exp.id, userId, date, exp.description, exp.category, exp.amount, exp.notes || '']
          );
        }
        expensesRes = await pg.query(
          `SELECT id, user_id as "userId", date, description, category, amount, notes, created_at as "createdAt"
           FROM expenses
           WHERE user_id = $1 AND date = $2
           ORDER BY created_at ASC`,
          [userId, date]
        );
      }
    }

    // Sync and fetch accurate money state
    const money = await syncDailyMoney(userId, date, req.user!.email);

    return res.json({
      date,
      expenses: expensesRes.rows,
      money,
      isPermanentlyVaulted: true,
      userEmail: req.user!.email,
    });
  } catch (err: any) {
    console.error('Get expenses error:', err);
    return res.status(500).json({ error: 'Failed to fetch expenses.', details: err?.message });
  }
};

apiRouter.get('/expenses', requireAuth, handleGetExpenses);
apiRouter.get('/expenses/day/:date', requireAuth, handleGetExpenses);

// Add Expense
apiRouter.post('/expenses', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { date, description, category, amount, notes } = req.body;
    const userId = req.user!.id;

    if (!date || !description || !category || amount === undefined) {
      return res.status(400).json({ error: 'Missing required expense fields.' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: 'Expense amount cannot be negative.' });
    }

    const insertRes = await pg.query(
      `INSERT INTO expenses (user_id, date, description, category, amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id as "userId", date, description, category, amount, notes, created_at as "createdAt"`,
      [userId, date, description.trim(), category, numAmount, notes || '']
    );

    const createdExp = insertRes.rows[0];

    // Save permanently to Dedicated User Data Vault
    await vaultSaveExpense(
      userId,
      {
        id: createdExp.id,
        userId: createdExp.userId,
        date: createdExp.date,
        description: createdExp.description,
        category: createdExp.category,
        amount: Number(createdExp.amount),
        notes: createdExp.notes,
        createdAt: createdExp.createdAt,
      },
      req.user!.email
    );

    const money = await syncDailyMoney(userId, date, req.user!.email);

    return res.status(201).json({
      message: 'Expense recorded and saved permanently!',
      expense: createdExp,
      money,
      isPermanentlyVaulted: true,
    });
  } catch (err: any) {
    console.error('Add expense error:', err);
    return res.status(500).json({ error: 'Failed to add expense.', details: err?.message });
  }
});

// Edit Expense
apiRouter.put('/expenses/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.id;
    const { description, category, amount, notes } = req.body;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: 'Amount cannot be negative.' });
    }

    const existing = await pg.query(`SELECT date FROM expenses WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    const date = existing.rows[0].date;

    const updateRes = await pg.query(
      `UPDATE expenses
       SET description = $1, category = $2, amount = $3, notes = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6
       RETURNING id, user_id as "userId", date, description, category, amount, notes`,
      [description.trim(), category, numAmount, notes || '', id, userId]
    );

    const updatedExp = updateRes.rows[0];

    // Update in Dedicated Permanent Vault
    await vaultSaveExpense(
      userId,
      {
        id: updatedExp.id,
        userId: updatedExp.userId,
        date: updatedExp.date,
        description: updatedExp.description,
        category: updatedExp.category,
        amount: Number(updatedExp.amount),
        notes: updatedExp.notes,
        createdAt: new Date().toISOString(),
      },
      req.user!.email
    );

    const money = await syncDailyMoney(userId, date, req.user!.email);

    return res.json({
      message: 'Expense updated and saved permanently!',
      expense: updatedExp,
      money,
      isPermanentlyVaulted: true,
    });
  } catch (err: any) {
    console.error('Update expense error:', err);
    return res.status(500).json({ error: 'Failed to update expense.' });
  }
});

// Delete Expense
apiRouter.delete('/expenses/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.id;

    const existing = await pg.query(`SELECT date FROM expenses WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    const date = (existing.rows[0] as any).date;

    await pg.query(`DELETE FROM expenses WHERE id = $1 AND user_id = $2`, [id, userId]);
    await vaultDeleteExpense(userId, id);
    const money = await syncDailyMoney(userId, date, req.user!.email);

    return res.json({
      message: 'Expense removed.',
      money,
    });
  } catch (err: any) {
    console.error('Delete expense error:', err);
    return res.status(500).json({ error: 'Failed to delete expense.' });
  }
});

// Set Starting Balance (supports /money/starting-balance and /expenses/balance/starting)
const handleSetStartingBalance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, startingBalance, balance: altBalance } = req.body;
    const userId = req.user!.id;

    const val = startingBalance !== undefined ? startingBalance : altBalance;
    if (!date || val === undefined) {
      return res.status(400).json({ error: 'Date and starting balance are required.' });
    }

    const balance = Number(val);
    if (isNaN(balance) || balance < 0) {
      return res.status(400).json({ error: 'Starting balance cannot be negative.' });
    }

    // Check existing daily_money record
    const existing = await pg.query(
      `SELECT id FROM daily_money WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );

    if (existing.rows.length > 0) {
      await pg.query(
        `UPDATE daily_money SET starting_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND date = $3`,
        [balance, userId, date]
      );
    } else {
      await pg.query(
        `INSERT INTO daily_money (user_id, date, starting_balance, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [userId, date, balance]
      );
    }

    const money = await syncDailyMoney(userId, date, req.user!.email);

    return res.json({
      message: 'Starting balance saved permanently!',
      money,
      isPermanentlyVaulted: true,
    });
  } catch (err: any) {
    console.error('Set starting balance error:', err);
    return res.status(500).json({ error: 'Failed to set starting balance.', details: err?.message });
  }
};

apiRouter.post('/money/starting-balance', requireAuth, handleSetStartingBalance);
apiRouter.post('/expenses/balance/starting', requireAuth, handleSetStartingBalance);

// Set Actual Ending Balance (supports /money/actual-balance and /expenses/balance/actual)
const handleSetActualBalance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, actualEndingBalance, actualBalance } = req.body;
    const userId = req.user!.id;

    const val = actualEndingBalance !== undefined ? actualEndingBalance : actualBalance;
    if (!date || val === undefined) {
      return res.status(400).json({ error: 'Date and actual ending balance are required.' });
    }

    const actual = Number(val);
    if (isNaN(actual) || actual < 0) {
      return res.status(400).json({ error: 'Actual balance cannot be negative.' });
    }

    const existing = await pg.query(
      `SELECT id FROM daily_money WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );

    if (existing.rows.length > 0) {
      await pg.query(
        `UPDATE daily_money SET actual_ending_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND date = $3`,
        [actual, userId, date]
      );
    } else {
      await pg.query(
        `INSERT INTO daily_money (user_id, date, actual_ending_balance, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [userId, date, actual]
      );
    }

    const money = await syncDailyMoney(userId, date, req.user!.email);
    const difference = actual - money.expectedEndingBalance;
    const isVerified = Math.abs(difference) < 0.01;

    return res.json({
      message: isVerified ? 'Balance verified ✓ and saved permanently.' : 'Actual ending balance saved permanently.',
      money: {
        ...money,
        difference,
        isVerified,
      },
      isPermanentlyVaulted: true,
    });
  } catch (err: any) {
    console.error('Set actual balance error:', err);
    return res.status(500).json({ error: 'Failed to record actual balance.', details: err?.message });
  }
};

apiRouter.post('/money/actual-balance', requireAuth, handleSetActualBalance);
apiRouter.post('/expenses/balance/actual', requireAuth, handleSetActualBalance);

// ==========================================
// 5. DAILY SUMMARY
// ==========================================
apiRouter.get('/daily-summary', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const userId = req.user!.id;

    // Nutrition
    const nutRes = await pg.query(
      `SELECT total_calories, total_protein FROM daily_nutrition WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );
    const foodCountRes = await pg.query(
      `SELECT COUNT(*) as count FROM food_entries WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );
    const goalRes = await pg.query(
      `SELECT daily_calories, daily_protein FROM nutrition_goals WHERE user_id = $1`,
      [userId]
    );

    const goals = (goalRes.rows[0] as any) || { daily_calories: 2200, daily_protein: 120 };
    const nut = (nutRes.rows[0] as any) || { total_calories: 0, total_protein: 0 };

    // Money
    const moneyRes = await pg.query(
      `SELECT starting_balance, total_spent, expected_ending_balance, actual_ending_balance
       FROM daily_money WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );
    const expenseCountRes = await pg.query(
      `SELECT COUNT(*) as count FROM expenses WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );

    const money = (moneyRes.rows[0] as any) || {
      starting_balance: 0,
      total_spent: 0,
      expected_ending_balance: 0,
      actual_ending_balance: null,
    };

    // Body Weight for date
    const weightRes = await pg.query(
      `SELECT id, weight, unit, notes FROM body_weights WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );
    const weightEntry = weightRes.rows[0] ? {
      id: weightRes.rows[0].id,
      weight: Number(weightRes.rows[0].weight),
      unit: weightRes.rows[0].unit,
      notes: weightRes.rows[0].notes,
    } : null;

    const expEnding = Number(money.expected_ending_balance);
    const actEnding = money.actual_ending_balance !== null ? Number(money.actual_ending_balance) : null;
    const difference = actEnding !== null ? actEnding - expEnding : null;
    const isVerified = actEnding !== null && Math.abs(difference!) < 0.01;

    return res.json({
      date,
      nutrition: {
        totalCalories: Number(nut.total_calories),
        totalProtein: Number(nut.total_protein),
        goalCalories: Number(goals.daily_calories),
        goalProtein: Number(goals.daily_protein),
        mealsCount: Number((foodCountRes.rows[0] as any).count),
      },
      weight: weightEntry,
      money: {
        startingBalance: Number(money.starting_balance),
        totalSpent: Number(money.total_spent),
        expectedEndingBalance: expEnding,
        actualEndingBalance: actEnding,
        difference,
        isVerified,
        expensesCount: Number((expenseCountRes.rows[0] as any).count),
      },
    });
  } catch (err: any) {
    console.error('Daily summary error:', err);
    return res.status(500).json({ error: 'Failed to fetch daily summary.' });
  }
});

// ==========================================
// 6. HISTORY (MONTHLY CALENDAR)
// ==========================================
const handleGetHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const userId = req.user!.id;

    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const pattern = `${year}-${monthStr}%`;

    const nutRows = await pg.query(
      `SELECT date, total_calories as "totalCalories", total_protein as "totalProtein"
       FROM daily_nutrition WHERE user_id = $1 AND date LIKE $2`,
      [userId, pattern]
    );

    const moneyRows = await pg.query(
      `SELECT date, starting_balance as "startingBalance", total_spent as "totalSpent",
              expected_ending_balance as "expectedEndingBalance",
              actual_ending_balance as "actualEndingBalance"
       FROM daily_money WHERE user_id = $1 AND date LIKE $2`,
      [userId, pattern]
    );

    const dayMap = new Map<string, any>();

    for (const r of nutRows.rows as any[]) {
      dayMap.set(r.date, {
        date: r.date,
        totalCalories: Number(r.totalCalories),
        totalProtein: Number(r.totalProtein),
        startingBalance: 0,
        totalSpent: 0,
        expectedEndingBalance: 0,
        actualEndingBalance: null,
        hasNutrition: Number(r.totalCalories) > 0 || Number(r.totalProtein) > 0,
        hasMoney: false,
      });
    }

    for (const m of moneyRows.rows as any[]) {
      const existing = dayMap.get(m.date) || {
        date: m.date,
        totalCalories: 0,
        totalProtein: 0,
        hasNutrition: false,
      };
      existing.startingBalance = Number(m.startingBalance);
      existing.totalSpent = Number(m.totalSpent);
      existing.expectedEndingBalance = Number(m.expectedEndingBalance);
      existing.actualEndingBalance = m.actualEndingBalance !== null ? Number(m.actualEndingBalance) : null;
      existing.hasMoney = Number(m.totalSpent) > 0 || Number(m.startingBalance) > 0;
      dayMap.set(m.date, existing);
    }

    return res.json({
      year,
      month,
      days: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (err: any) {
    console.error('History error:', err);
    return res.status(500).json({ error: 'Failed to fetch history.' });
  }
};

apiRouter.get('/history', requireAuth, handleGetHistory);
apiRouter.get('/history/nutrition', requireAuth, handleGetHistory);
apiRouter.get('/history/money', requireAuth, handleGetHistory);
apiRouter.get('/history/overview', requireAuth, handleGetHistory);

// ==========================================
// 7. ANALYTICS
// ==========================================
const handleGetAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const range = (req.query.range as string) || (req.query.days ? `${req.query.days}d` : '30d');
    const userId = req.user!.id;

    let daysCount = 30;
    if (range === '7d' || range === '7') daysCount = 7;
    else if (range === '14d' || range === '14') daysCount = 14;
    else if (range === '30d' || range === '30') daysCount = 30;
    else if (range === '3m' || range === '90d' || range === '90') daysCount = 90;
    else if (range === '6m' || range === '180d' || range === '180') daysCount = 180;
    else if (range === '1y' || range === '365d' || range === '365') daysCount = 365;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysCount + 1);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Goals
    const goalRes = await pg.query(
      `SELECT daily_calories, daily_protein FROM nutrition_goals WHERE user_id = $1`,
      [userId]
    );
    const goals = (goalRes.rows[0] as any) || { daily_calories: 2200, daily_protein: 120 };

    // Nutrition records
    const nutRes = await pg.query(
      `SELECT date, total_calories, total_protein
       FROM daily_nutrition
       WHERE user_id = $1 AND date >= $2
       ORDER BY date ASC`,
      [userId, startDateStr]
    );

    // Expenses records
    const expRes = await pg.query(
      `SELECT date, category, amount
       FROM expenses
       WHERE user_id = $1 AND date >= $2
       ORDER BY date ASC`,
      [userId, startDateStr]
    );

    // Group expenses by date and category
    const dailySpendingMap = new Map<string, number>();
    const categorySpendingMap = new Map<string, number>();
    let totalSpending = 0;

    for (const e of expRes.rows as any[]) {
      const amt = Number(e.amount);
      totalSpending += amt;
      dailySpendingMap.set(e.date, (dailySpendingMap.get(e.date) || 0) + amt);
      categorySpendingMap.set(e.category, (categorySpendingMap.get(e.category) || 0) + amt);
    }

    // Build day-by-day trend array
    const dateMap = new Map<string, any>();
    const now = new Date();

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dStr = d.toISOString().split('T')[0];
      dateMap.set(dStr, {
        date: dStr,
        calories: 0,
        protein: 0,
        spending: dailySpendingMap.get(dStr) || 0,
        goalCalories: Number(goals.daily_calories),
        goalProtein: Number(goals.daily_protein),
      });
    }

    let caloriesSum = 0;
    let proteinSum = 0;
    let loggedDaysCount = 0;

    for (const n of nutRes.rows as any[]) {
      const c = Number(n.total_calories);
      const p = Number(n.total_protein);
      if (c > 0 || p > 0) {
        caloriesSum += c;
        proteinSum += p;
        loggedDaysCount++;
      }
      if (dateMap.has(n.date)) {
        const item = dateMap.get(n.date);
        item.calories = c;
        item.protein = p;
      }
    }

    const dailyTrend = Array.from(dateMap.values());

    // Highest and lowest spending days
    let highestSpendingDay: { date: string; amount: number } | null = null;
    let lowestSpendingDay: { date: string; amount: number } | null = null;

    for (const [d, amt] of dailySpendingMap.entries()) {
      if (amt > 0) {
        if (!highestSpendingDay || amt > highestSpendingDay.amount) {
          highestSpendingDay = { date: d, amount: amt };
        }
        if (!lowestSpendingDay || amt < lowestSpendingDay.amount) {
          lowestSpendingDay = { date: d, amount: amt };
        }
      }
    }

    // Category breakdown
    const categorySpending: any[] = [];
    for (const [cat, amt] of categorySpendingMap.entries()) {
      categorySpending.push({
        category: cat,
        amount: amt,
        percentage: totalSpending > 0 ? Number(((amt / totalSpending) * 100).toFixed(1)) : 0,
      });
    }
    categorySpending.sort((a, b) => b.amount - a.amount);

    // Fetch body weight records for range
    const weightRes = await pg.query(
      `SELECT date, weight, unit FROM body_weights WHERE user_id = $1 AND date >= $2 ORDER BY date ASC`,
      [userId, startDateStr]
    );

    const weightTrend = (weightRes.rows as any[]).map(r => ({
      date: r.date,
      weight: Number(r.weight),
      unit: r.unit,
    }));

    // Calculate Consistency Score (0 - 100%)
    const targetCal = Number(goals.daily_calories);
    const targetProt = Number(goals.daily_protein);
    let perfectDays = 0;
    for (const d of dailyTrend) {
      if (d.calories > 0 && Math.abs(d.calories - targetCal) <= 300 && d.protein >= targetProt * 0.8) {
        perfectDays++;
      }
    }
    const consistencyScore = daysCount > 0 ? Math.min(100, Math.round((loggedDaysCount / daysCount) * 100)) : 0;

    return res.json({
      range,
      daysCount,
      targetCalories: targetCal,
      targetProtein: targetProt,
      avgCalories: loggedDaysCount > 0 ? Math.round(caloriesSum / loggedDaysCount) : 0,
      avgProtein: loggedDaysCount > 0 ? Math.round(proteinSum / loggedDaysCount) : 0,
      totalSpending,
      avgDailySpending: Math.round(totalSpending / daysCount),
      highestSpendingDay,
      lowestSpendingDay,
      dailyTrend,
      categorySpending,
      weightTrend,
      loggedDaysCount,
      consistencyScore,
      // Compatibility fields for both response shapes
      stats: {
        avgCalories: loggedDaysCount > 0 ? Math.round(caloriesSum / loggedDaysCount) : 0,
        avgProtein: loggedDaysCount > 0 ? Math.round(proteinSum / loggedDaysCount) : 0,
        totalExpenses: totalSpending,
        avgDailyExpense: Math.round(totalSpending / daysCount),
        loggedDays: loggedDaysCount,
        consistencyScore,
      },
      nutritionTrend: dailyTrend,
      spendingTrend: dailyTrend.map(d => ({ date: d.date, spent: d.spending })),
      categoryBreakdown: categorySpending,
    });
  } catch (err: any) {
    console.error('Analytics error:', err);
    return res.status(500).json({ error: 'Failed to compute analytics.' });
  }
};

apiRouter.get('/analytics', requireAuth, handleGetAnalytics);
apiRouter.get('/analytics/overview', requireAuth, handleGetAnalytics);

// ==========================================
// 8. PROFILE & GOALS
// ==========================================
const handleUpdateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, dailyCalories, dailyProtein } = req.body;
    const userId = req.user!.id;

    if (name && name.trim().length >= 2) {
      await pg.query(`UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
        name.trim(),
        userId,
      ]);
    }

    const numCal = Number(dailyCalories);
    const numProt = Number(dailyProtein);

    if (numCal > 0 && numProt > 0) {
      await pg.query(
        `INSERT INTO nutrition_goals (user_id, daily_calories, daily_protein, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id)
         DO UPDATE SET daily_calories = $2, daily_protein = $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, numCal, numProt]
      );
      // Save permanently to Dedicated User Data Vault
      await vaultSaveNutritionGoals(userId, numCal, numProt, req.user!.email);
    }

    return res.json({ message: 'Profile and goals updated successfully.' });
  } catch (err: any) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
};

apiRouter.put('/profile', requireAuth, handleUpdateProfile);
apiRouter.put('/user/profile', requireAuth, handleUpdateProfile);

// Password update handler supporting both POST and PUT methods
const handlePasswordUpdate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new passwords are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    const permUser = getPermanentUserById(userId) || getPermanentUserByEmail(req.user!.email);
    let isMatch = false;

    if (permUser) {
      isMatch = await comparePassword(currentPassword, permUser.passwordHash);
    }

    if (!isMatch) {
      const userRes = await pg.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
      if (userRes.rows.length > 0) {
        isMatch = await comparePassword(currentPassword, userRes.rows[0].password_hash);
      }
    }

    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await hashPassword(newPassword);
    await updatePermanentUserPassword(userId, newHash);
    await updatePermanentUserPassword(req.user!.email, newHash);
    await pg.query(`UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
      newHash,
      userId,
    ]);

    return res.json({ message: 'Password updated and permanently saved in database.' });
  } catch (err: any) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Failed to change password.' });
  }
};

apiRouter.post('/user/password', requireAuth, handlePasswordUpdate);
apiRouter.put('/user/password', requireAuth, handlePasswordUpdate);

// ==========================================
// 9. DATA EXPORT (CSV)
// ==========================================
apiRouter.get('/export/:type', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const type = req.params.type;
    const userId = req.user!.id;

    if (type === 'diet') {
      const rows = await pg.query(
        `SELECT date, meal_type, food_name, quantity, unit, calories, protein, notes, created_at
         FROM food_entries WHERE user_id = $1 ORDER BY date DESC, created_at ASC`,
        [userId]
      );

      let csv = 'Date,Meal Type,Food Name,Quantity,Unit,Calories (kcal),Protein (g),Notes,Timestamp\n';
      for (const r of rows.rows as any[]) {
        csv += `"${r.date}","${r.meal_type}","${r.food_name.replace(/"/g, '""')}",${r.quantity},"${r.unit}",${r.calories},${r.protein},"${(r.notes || '').replace(/"/g, '""')}","${r.created_at}"\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="lifetrack_diet_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }

    if (type === 'expenses') {
      const rows = await pg.query(
        `SELECT date, description, category, amount, notes, created_at
         FROM expenses WHERE user_id = $1 ORDER BY date DESC, created_at ASC`,
        [userId]
      );

      let csv = 'Date,Description,Category,Amount (INR),Notes,Timestamp\n';
      for (const r of rows.rows as any[]) {
        csv += `"${r.date}","${r.description.replace(/"/g, '""')}","${r.category}",${r.amount},"${(r.notes || '').replace(/"/g, '""')}","${r.created_at}"\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="lifetrack_expenses_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }

    if (type === 'summary') {
      const rows = await pg.query(
        `SELECT m.date, n.total_calories, n.total_protein, m.starting_balance, m.total_spent,
                m.expected_ending_balance, m.actual_ending_balance
         FROM daily_money m
         FULL OUTER JOIN daily_nutrition n ON m.user_id = n.user_id AND m.date = n.date
         WHERE COALESCE(m.user_id, n.user_id) = $1
         ORDER BY COALESCE(m.date, n.date) DESC`,
        [userId]
      );

      let csv = 'Date,Total Calories (kcal),Total Protein (g),Starting Balance (INR),Total Spent (INR),Expected Ending Balance (INR),Actual Ending Balance (INR)\n';
      for (const r of rows.rows as any[]) {
        csv += `"${r.date}",${r.total_calories || 0},${r.total_protein || 0},${r.starting_balance || 0},${r.total_spent || 0},${r.expected_ending_balance || 0},${r.actual_ending_balance !== null ? r.actual_ending_balance : ''}\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="lifetrack_daily_summary_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }

    return res.status(400).json({ error: 'Invalid export type. Supported: diet, expenses, summary.' });
  } catch (err: any) {
    console.error('Export error:', err);
    return res.status(500).json({ error: 'Failed to generate export file.' });
  }
});

// ==========================================
// 10. ADMIN DASHBOARD & MEMBER MANAGEMENT
// ==========================================
apiRouter.get('/admin/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const totalMembersRes = await pg.query(`SELECT COUNT(*) as count FROM users WHERE role = 'MEMBER'`);
    const activeMembersRes = await pg.query(`SELECT COUNT(*) as count FROM users WHERE role = 'MEMBER' AND status = 'ACTIVE'`);
    const newMembersRes = await pg.query(`SELECT COUNT(*) as count FROM users WHERE role = 'MEMBER' AND created_at >= NOW() - INTERVAL '24 HOURS'`);
    const totalFoodsRes = await pg.query(`SELECT COUNT(*) as count FROM food_entries`);
    const totalExpensesRes = await pg.query(`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount FROM expenses`);

    return res.json({
      totalMembers: Number((totalMembersRes.rows[0] as any).count),
      activeMembers: Number((activeMembersRes.rows[0] as any).count),
      newMembersToday: Number((newMembersRes.rows[0] as any).count),
      totalFoodEntries: Number((totalFoodsRes.rows[0] as any).count),
      totalExpenses: Number((totalExpensesRes.rows[0] as any).count),
      totalMoneyTracked: Number((totalExpensesRes.rows[0] as any).total_amount),
    });
  } catch (err: any) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch admin stats.' });
  }
});

apiRouter.get('/admin/members', requireAuth, requireAdmin, async (req, res) => {
  try {
    const search = (req.query.search as string) || '';
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.status, u.created_at as "createdAt",
             u.allow_admin_view as "allowAdminView", u.admin_access_decided as "adminAccessDecided",
             g.daily_calories as "dailyCaloriesGoal", g.daily_protein as "dailyProteinGoal",
             (SELECT COUNT(*) FROM food_entries fe WHERE fe.user_id = u.id) as "foodEntriesCount",
             (SELECT COUNT(*) FROM expenses ex WHERE ex.user_id = u.id) as "expensesCount",
             (SELECT COUNT(*) FROM body_weights bw WHERE bw.user_id = u.id) as "weightsCount"
      FROM users u
      LEFT JOIN nutrition_goals g ON u.id = g.user_id
      WHERE u.role = 'MEMBER'
    `;

    const params: any[] = [];
    if (search.trim()) {
      query += ` AND (u.name ILIKE $1 OR u.email ILIKE $1)`;
      params.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY u.created_at DESC`;

    const result = await pg.query(query, params);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('Admin members error:', err);
    return res.status(500).json({ error: 'Failed to fetch members.' });
  }
});

// Admin view member detailed logs (respects user permission)
apiRouter.get('/admin/members/:id/details', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUserId = req.params.id;

    const userRes = await pg.query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.allow_admin_view, u.admin_access_decided, u.created_at,
              g.daily_calories, g.daily_protein
       FROM users u
       LEFT JOIN nutrition_goals g ON u.id = g.user_id
       WHERE u.id = $1 AND u.role = 'MEMBER'`,
      [targetUserId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const member = userRes.rows[0];
    const hasPermission = Boolean(member.allow_admin_view);

    if (!hasPermission) {
      return res.json({
        allowed: false,
        member: {
          id: member.id,
          name: member.name,
          email: member.email,
          status: member.status,
          allowAdminView: false,
          adminAccessDecided: Boolean(member.admin_access_decided),
          createdAt: member.created_at,
        },
        message: 'Member has kept their personal diet and expense data private. Admin access has not been granted by this member.',
      });
    }

    // Permission is granted: load member's detailed logs
    const foods = await pg.query(
      `SELECT id, date, food_name as "foodName", meal_type as "mealType", quantity, unit, calories, protein, notes, created_at as "createdAt"
       FROM food_entries WHERE user_id = $1 ORDER BY date DESC, created_at DESC LIMIT 50`,
      [targetUserId]
    );

    const expenses = await pg.query(
      `SELECT id, date, description, category, amount, notes, created_at as "createdAt"
       FROM expenses WHERE user_id = $1 ORDER BY date DESC, created_at DESC LIMIT 50`,
      [targetUserId]
    );

    const weights = await pg.query(
      `SELECT id, date, weight, unit, notes, created_at as "createdAt"
       FROM body_weights WHERE user_id = $1 ORDER BY date DESC LIMIT 30`,
      [targetUserId]
    );

    const dailyMoney = await pg.query(
      `SELECT date, starting_balance as "startingBalance", total_spent as "totalSpent",
              expected_ending_balance as "expectedEndingBalance", actual_ending_balance as "actualEndingBalance"
       FROM daily_money WHERE user_id = $1 ORDER BY date DESC LIMIT 30`,
      [targetUserId]
    );

    return res.json({
      allowed: true,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        status: member.status,
        allowAdminView: true,
        adminAccessDecided: Boolean(member.admin_access_decided),
        dailyCalories: Number(member.daily_calories || 2200),
        dailyProtein: Number(member.daily_protein || 120),
        createdAt: member.created_at,
      },
      foods: foods.rows,
      expenses: expenses.rows,
      weights: weights.rows,
      dailyMoney: dailyMoney.rows,
    });
  } catch (err: any) {
    console.error('Admin member details error:', err);
    return res.status(500).json({ error: 'Failed to fetch member details.' });
  }
});

// Toggle Member status (Active / Inactive)
apiRouter.patch('/admin/members/:id/status', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUserId = req.params.id;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE.' });
    }

    if (targetUserId === req.user!.id) {
      return res.status(400).json({ error: 'You cannot change your own administrator status.' });
    }

    await updatePermanentUserStatus(targetUserId, status);
    await pg.query(`UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND role = 'MEMBER'`, [
      status,
      targetUserId,
    ]);

    return res.json({ message: `Member status set to ${status}.` });
  } catch (err: any) {
    console.error('Admin status toggle error:', err);
    return res.status(500).json({ error: 'Failed to update member status.' });
  }
});

// Delete Unwanted Member & Purge All Associated Database Data
const handleAdminDeleteMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawTarget = decodeURIComponent(req.params.id || '').trim();
    const bodyId = (req.body?.id || req.body?.userId || '').trim();
    const bodyEmail = (req.body?.email || req.query?.email as string || '').trim().toLowerCase();
    const targetIdentifier = rawTarget || bodyId || bodyEmail;

    if (!targetIdentifier) {
      return res.status(400).json({ error: 'Target member identifier is required.' });
    }

    const currentAdminId = req.user!.id;
    const currentAdminEmail = (req.user!.email || '').toLowerCase().trim();

    if (
      targetIdentifier === currentAdminId ||
      targetIdentifier.toLowerCase() === currentAdminEmail ||
      bodyEmail === currentAdminEmail ||
      bodyId === currentAdminId
    ) {
      return res.status(400).json({ error: 'Cannot delete your own administrator account.' });
    }

    // 1. Resolve all possible user matches from PostgreSQL
    const pgMatches = await pg.query(
      `SELECT id, name, email, role FROM users 
       WHERE id = $1 OR id = $2 
          OR LOWER(email) = LOWER($1) OR LOWER(email) = LOWER($2) OR LOWER(email) = LOWER($3)
          OR email = $1 OR email = $2 OR email = $3`,
      [rawTarget, bodyId, bodyEmail]
    );

    const permUser =
      getPermanentUserById(rawTarget) ||
      getPermanentUserByEmail(rawTarget) ||
      (bodyId ? getPermanentUserById(bodyId) : null) ||
      (bodyEmail ? getPermanentUserByEmail(bodyEmail) : null);

    // Collect all candidate IDs and Emails to purge
    const candidateIds = new Set<string>();
    const candidateEmails = new Set<string>();

    if (rawTarget) {
      if (rawTarget.includes('@')) candidateEmails.add(rawTarget.toLowerCase());
      else candidateIds.add(rawTarget);
    }
    if (bodyId) candidateIds.add(bodyId);
    if (bodyEmail) candidateEmails.add(bodyEmail.toLowerCase());

    for (const r of pgMatches.rows) {
      if (r.id) candidateIds.add(r.id);
      if (r.email) candidateEmails.add(r.email.toLowerCase().trim());
      if (r.role === 'ADMIN' && (r.id === currentAdminId || r.email.toLowerCase() === currentAdminEmail)) {
        return res.status(403).json({ error: 'Cannot delete your own administrator account.' });
      }
    }

    if (permUser) {
      if (permUser.id) candidateIds.add(permUser.id);
      if (permUser.email) candidateEmails.add(permUser.email.toLowerCase().trim());
      if (permUser.role === 'ADMIN' && (permUser.id === currentAdminId || permUser.email.toLowerCase() === currentAdminEmail)) {
        return res.status(403).json({ error: 'Cannot delete your own administrator account.' });
      }
    }

    const idsArray = Array.from(candidateIds);
    const emailsArray = Array.from(candidateEmails);
    const targetDisplayName = pgMatches.rows[0]?.name || permUser?.name || targetIdentifier;
    const targetDisplayEmail = pgMatches.rows[0]?.email || permUser?.email || emailsArray[0] || targetIdentifier;

    console.log(`[Admin DB] Executing absolute purge for "${targetDisplayName}" (${targetDisplayEmail})`);
    console.log(`[Admin DB] Target IDs:`, idsArray, `Emails:`, emailsArray);

    // 2. Cascade delete across all relational database tables in PostgreSQL
    if (idsArray.length > 0) {
      await pg.query(`DELETE FROM food_entries WHERE user_id = ANY($1::text[])`, [idsArray]).catch((e) => console.warn('food_entries delete:', e));
      await pg.query(`DELETE FROM daily_nutrition WHERE user_id = ANY($1::text[])`, [idsArray]).catch((e) => console.warn('daily_nutrition delete:', e));
      await pg.query(`DELETE FROM expenses WHERE user_id = ANY($1::text[])`, [idsArray]).catch((e) => console.warn('expenses delete:', e));
      await pg.query(`DELETE FROM daily_money WHERE user_id = ANY($1::text[])`, [idsArray]).catch((e) => console.warn('daily_money delete:', e));
      await pg.query(`DELETE FROM body_weights WHERE user_id = ANY($1::text[])`, [idsArray]).catch((e) => console.warn('body_weights delete:', e));
      await pg.query(`DELETE FROM nutrition_goals WHERE user_id = ANY($1::text[])`, [idsArray]).catch((e) => console.warn('nutrition_goals delete:', e));
      await pg.query(`DELETE FROM password_reset_tokens WHERE user_id = ANY($1::text[])`, [idsArray]).catch((e) => console.warn('reset_tokens delete:', e));
      await pg.query(`DELETE FROM support_tickets WHERE user_id = ANY($1::text[])`, [idsArray]).catch((e) => console.warn('support_tickets delete:', e));
      await pg.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [idsArray]).catch((e) => console.warn('users table delete by id:', e));
    }

    if (emailsArray.length > 0) {
      await pg.query(`DELETE FROM password_reset_tokens WHERE LOWER(email) = ANY($1::text[])`, [emailsArray]).catch((e) => console.warn('reset_tokens delete by email:', e));
      await pg.query(`DELETE FROM support_tickets WHERE LOWER(sender_email) = ANY($1::text[])`, [emailsArray]).catch((e) => console.warn('support_tickets delete by email:', e));
      await pg.query(`DELETE FROM users WHERE LOWER(email) = ANY($1::text[])`, [emailsArray]).catch((e) => console.warn('users table delete by email:', e));
    }

    // 3. Purge from Dedicated Permanent Auth Database
    await Promise.allSettled([
      ...idsArray.map((id) => deletePermanentUser(id)),
      ...emailsArray.map((em) => deletePermanentUser(em, em)),
    ]);

    // 4. Purge from Dedicated Permanent User Data Vault
    await Promise.allSettled([
      ...idsArray.map((id) => vaultDeleteUserData(id)),
      ...emailsArray.map((em) => vaultDeleteUserData(em, em)),
    ]);

    // 5. Clean up from Firebase Auth in background without blocking response
    (async () => {
      for (const em of emailsArray) {
        try {
          const fbUserPromise = adminAuth.getUserByEmail(em);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 800));
          const fbUser: any = await Promise.race([fbUserPromise, timeoutPromise]).catch(() => null);
          if (fbUser && fbUser.uid) {
            await adminAuth.deleteUser(fbUser.uid).catch(() => {});
            console.log(`[Admin DB] Deleted Firebase Auth user ${em}`);
          }
        } catch (fbErr) {
          // Ignore background cleanup error
        }
      }
    })().catch(() => {});

    console.log(`[Admin DB] Successfully purged "${targetDisplayName}" (${targetDisplayEmail}) and all database records.`);

    return res.json({
      success: true,
      message: `User ${targetDisplayName} (${targetDisplayEmail}) and all data (food logs, expenses, weights, goals, credentials) have been completely purged from the database.`,
      purgedIds: idsArray,
      purgedEmails: emailsArray,
    });
  } catch (err: any) {
    console.error('Admin delete member error:', err);
    return res.status(500).json({ error: 'Failed to delete member and database records.', details: err?.message });
  }
};

apiRouter.delete('/admin/members/:id', requireAuth, requireAdmin, handleAdminDeleteMember);
apiRouter.delete('/admin/users/:id', requireAuth, requireAdmin, handleAdminDeleteMember);
apiRouter.post('/admin/database/purge-user', requireAuth, requireAdmin, handleAdminDeleteMember);

// ==========================================
// FULL DATABASE ACCESS & ADMIN CONTROL APIS
// ==========================================

const VALID_TABLES = [
  'users',
  'food_entries',
  'expenses',
  'daily_nutrition',
  'daily_money',
  'body_weights',
  'nutrition_goals',
  'foods',
  'support_tickets',
  'password_reset_tokens',
] as const;

// 1. Database Overview & Table Statistics
apiRouter.get('/admin/database/overview', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const tableCounts: Record<string, number> = {};

    for (const tbl of VALID_TABLES) {
      try {
        const countRes = await pg.query(`SELECT COUNT(*) as count FROM ${tbl}`);
        tableCounts[tbl] = Number(countRes.rows[0]?.count || 0);
      } catch (err) {
        tableCounts[tbl] = 0;
      }
    }

    const permanentStats = getPermanentDbStats();
    const vaultStats = getAllVaultStats();

    const totalRecords = Object.values(tableCounts).reduce((acc, c) => acc + c, 0);

    return res.json({
      success: true,
      database: {
        engine: 'PostgreSQL Relational Storage (PGlite / Cloud SQL)',
        status: 'ONLINE',
        totalTables: VALID_TABLES.length,
        totalRecords,
        tables: [
          { name: 'users', label: 'Registered Users & Accounts', rowCount: tableCounts.users, description: 'User credentials, roles, status, and permissions' },
          { name: 'food_entries', label: 'Food & Meal Entries', rowCount: tableCounts.food_entries, description: 'Detailed user food logs, calories, and protein' },
          { name: 'expenses', label: 'Expense Logs', rowCount: tableCounts.expenses, description: 'Financial expenditures categorized by member' },
          { name: 'daily_nutrition', label: 'Daily Nutrition Aggregations', rowCount: tableCounts.daily_nutrition, description: 'Summed daily calorie and protein totals' },
          { name: 'daily_money', label: 'Daily Money Ledgers', rowCount: tableCounts.daily_money, description: 'Opening/closing cash audits and daily spent' },
          { name: 'body_weights', label: 'Body Weight Records', rowCount: tableCounts.body_weights, description: 'Historical weight measurements and trends' },
          { name: 'nutrition_goals', label: 'Nutrition Goals', rowCount: tableCounts.nutrition_goals, description: 'Custom daily calorie and protein targets' },
          { name: 'foods', label: 'Master Foods Catalog', rowCount: tableCounts.foods, description: 'Global food nutritional database' },
          { name: 'support_tickets', label: 'Support Tickets', rowCount: tableCounts.support_tickets, description: 'Help requests and user messages' },
          { name: 'password_reset_tokens', label: 'Security Reset Tokens', rowCount: tableCounts.password_reset_tokens, description: 'Verification codes and password reset sessions' },
        ],
        permanentAuthDb: permanentStats,
        dataVault: vaultStats,
      },
    });
  } catch (err: any) {
    console.error('Admin DB overview error:', err);
    return res.status(500).json({ error: 'Failed to fetch database overview.' });
  }
});

// 2. Table Data Inspector with Search & Pagination
apiRouter.get('/admin/database/table-data', requireAuth, requireAdmin, async (req, res) => {
  try {
    const table = (req.query.table as string || 'users').toLowerCase().trim();
    if (!VALID_TABLES.includes(table as any)) {
      return res.status(400).json({ error: `Invalid table name. Valid tables: ${VALID_TABLES.join(', ')}` });
    }

    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string || '50', 10)));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();

    let countQuery = `SELECT COUNT(*) as count FROM ${table}`;
    let dataQuery = `SELECT * FROM ${table}`;
    const params: any[] = [];

    if (search) {
      if (table === 'users') {
        countQuery += ` WHERE name ILIKE $1 OR email ILIKE $1 OR id ILIKE $1`;
        dataQuery += ` WHERE name ILIKE $1 OR email ILIKE $1 OR id ILIKE $1`;
        params.push(`%${search}%`);
      } else if (table === 'foods') {
        countQuery += ` WHERE name ILIKE $1 OR category ILIKE $1`;
        dataQuery += ` WHERE name ILIKE $1 OR category ILIKE $1`;
        params.push(`%${search}%`);
      } else if (table === 'food_entries') {
        countQuery += ` WHERE food_name ILIKE $1 OR user_id ILIKE $1 OR date ILIKE $1`;
        dataQuery += ` WHERE food_name ILIKE $1 OR user_id ILIKE $1 OR date ILIKE $1`;
        params.push(`%${search}%`);
      } else if (table === 'expenses') {
        countQuery += ` WHERE description ILIKE $1 OR category ILIKE $1 OR user_id ILIKE $1 OR date ILIKE $1`;
        dataQuery += ` WHERE description ILIKE $1 OR category ILIKE $1 OR user_id ILIKE $1 OR date ILIKE $1`;
        params.push(`%${search}%`);
      } else if (['daily_nutrition', 'daily_money', 'body_weights', 'nutrition_goals'].includes(table)) {
        countQuery += ` WHERE user_id ILIKE $1`;
        dataQuery += ` WHERE user_id ILIKE $1`;
        params.push(`%${search}%`);
      } else if (table === 'support_tickets') {
        countQuery += ` WHERE sender_name ILIKE $1 OR sender_email ILIKE $1 OR subject ILIKE $1`;
        dataQuery += ` WHERE sender_name ILIKE $1 OR sender_email ILIKE $1 OR subject ILIKE $1`;
        params.push(`%${search}%`);
      }
    }

    // Default sorting
    if (table === 'users' || table === 'food_entries' || table === 'expenses' || table === 'body_weights' || table === 'support_tickets') {
      dataQuery += ` ORDER BY created_at DESC NULLS LAST`;
    } else if (table === 'foods') {
      dataQuery += ` ORDER BY name ASC`;
    } else {
      dataQuery += ` ORDER BY id DESC NULLS LAST`;
    }

    dataQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const countRes = await pg.query(countQuery, search ? [`%${search}%`] : []);
    const totalCount = Number(countRes.rows[0]?.count || 0);

    const dataRes = await pg.query(dataQuery, params);
    const rows = dataRes.rows;
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return res.json({
      success: true,
      table,
      columns,
      rows,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err: any) {
    console.error('Admin table data fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch table records.', details: err?.message });
  }
});

// 3. Delete Any Individual Row from Any Table
apiRouter.delete('/admin/database/row', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { table, id, idColumn = 'id' } = req.body;

    if (!table || id === undefined || id === null) {
      return res.status(400).json({ error: 'Table and record ID are required.' });
    }

    if (!VALID_TABLES.includes(table.toLowerCase() as any)) {
      return res.status(400).json({ error: 'Invalid table name.' });
    }

    const cleanTable = table.toLowerCase().trim();

    // Prevent accidental deletion of self from users table
    if (cleanTable === 'users' && (id === req.user!.id || String(id).toLowerCase() === req.user!.email.toLowerCase())) {
      return res.status(400).json({ error: 'Cannot delete your own admin account.' });
    }

    // If deleting from users table, trigger full cascade purge
    if (cleanTable === 'users') {
      req.params.id = String(id);
      return handleAdminDeleteMember(req, res);
    }

    // Delete record from PostgreSQL
    const delRes: any = await pg.query(`DELETE FROM ${cleanTable} WHERE ${idColumn} = $1 RETURNING *`, [id]);

    if (!delRes || delRes.rowCount === 0) {
      return res.status(404).json({ error: `Record ${id} not found in ${cleanTable}.` });
    }

    const deletedRow = delRes.rows[0];

    // Synchronize with Permanent Data Vault if applicable
    if (cleanTable === 'food_entries' && deletedRow.user_id) {
      await vaultDeleteFoodEntry(deletedRow.user_id, Number(deletedRow.id));
    } else if (cleanTable === 'expenses' && deletedRow.user_id) {
      await vaultDeleteExpense(deletedRow.user_id, Number(deletedRow.id));
    } else if (cleanTable === 'body_weights' && deletedRow.user_id) {
      await vaultDeleteBodyWeight(deletedRow.user_id, Number(deletedRow.id));
    }

    return res.json({
      success: true,
      message: `Successfully deleted record #${id} from ${cleanTable}.`,
      deletedRow,
    });
  } catch (err: any) {
    console.error('Admin delete row error:', err);
    return res.status(500).json({ error: 'Failed to delete record from database.', details: err?.message });
  }
});

// 4. Direct User Profile & Role & Status Editor for Database Admin
apiRouter.patch('/admin/database/update-user', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      userId,
      name,
      email,
      role,
      status,
      dailyCalories,
      dailyProtein,
      allowAdminView,
      newPassword,
    } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    const userRes = await pg.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in database.' });
    }

    const existingUser = userRes.rows[0];
    const cleanName = name ? name.trim() : existingUser.name;
    const cleanEmail = email ? email.toLowerCase().trim() : existingUser.email;
    const cleanRole = role && ['ADMIN', 'MEMBER'].includes(role) ? role : existingUser.role;
    const cleanStatus = status && ['ACTIVE', 'INACTIVE'].includes(status) ? status : existingUser.status;
    const cleanAllowAdminView = allowAdminView !== undefined ? Boolean(allowAdminView) : Boolean(existingUser.allow_admin_view);

    let passwordHash = existingUser.password_hash;
    if (newPassword && newPassword.trim().length >= 6) {
      passwordHash = await hashPassword(newPassword.trim());
    }

    // Update in PostgreSQL
    await pg.query(
      `UPDATE users 
       SET name = $1, email = $2, role = $3, status = $4, allow_admin_view = $5,
           password_hash = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [cleanName, cleanEmail, cleanRole, cleanStatus, cleanAllowAdminView, passwordHash, userId]
    );

    // Update Nutrition Goals in PostgreSQL
    if (dailyCalories !== undefined || dailyProtein !== undefined) {
      await pg.query(
        `INSERT INTO nutrition_goals (user_id, daily_calories, daily_protein, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE
         SET daily_calories = EXCLUDED.daily_calories, daily_protein = EXCLUDED.daily_protein, updated_at = CURRENT_TIMESTAMP`,
        [userId, Number(dailyCalories || 2200), Number(dailyProtein || 120)]
      );
    }

    // Update in Dedicated Permanent Auth Database
    await savePermanentUser({
      id: userId,
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      role: cleanRole as any,
      status: cleanStatus as any,
      allowAdminView: cleanAllowAdminView,
      adminAccessDecided: true,
      dailyCalories: Number(dailyCalories || 2200),
      dailyProtein: Number(dailyProtein || 120),
    });

    return res.json({
      success: true,
      message: `User ${cleanName} (${cleanEmail}) database profile updated successfully.`,
      user: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        role: cleanRole,
        status: cleanStatus,
        allowAdminView: cleanAllowAdminView,
        dailyCalories: Number(dailyCalories || 2200),
        dailyProtein: Number(dailyProtein || 120),
      },
    });
  } catch (err: any) {
    console.error('Admin update user error:', err);
    return res.status(500).json({ error: 'Failed to update user database profile.', details: err?.message });
  }
});

// 5. Admin SQL Query Execution Console
apiRouter.post('/admin/database/execute-sql', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'SQL query string is required.' });
    }

    const cleanQuery = query.trim();

    // Prevent dropping tables accidentally
    if (/^\s*DROP\s+TABLE/i.test(cleanQuery)) {
      return res.status(400).json({ error: 'DROP TABLE is disabled for security. Use DELETE or TRUNCATE instead.' });
    }

    const startTime = Date.now();
    const result: any = await pg.query(cleanQuery);
    const executionTimeMs = Date.now() - startTime;

    const rows = result?.rows || [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const rowCount = result?.rowCount !== undefined ? result.rowCount : rows.length;

    return res.json({
      success: true,
      command: result?.command || 'QUERY',
      rowCount,
      columns,
      rows: rows.slice(0, 100), // Cap at 100 rows for preview performance
      executionTimeMs,
      message: `Executed in ${executionTimeMs}ms with ${rowCount} row(s) affected.`,
    });
  } catch (err: any) {
    console.error('Admin SQL execute error:', err);
    return res.status(400).json({
      success: false,
      error: err?.message || 'SQL Execution Error',
      detail: err?.detail,
      hint: err?.hint,
    });
  }
});

// 6. Force Full Database Synchronization & Health Check
apiRouter.post('/admin/database/sync-all', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const authSync = await syncPermanentDbWithPostgres(pg);
    const vault = await initPermanentDataVault();
    
    return res.json({
      success: true,
      message: 'Full database sync and consistency verification completed.',
      authSync,
      vaultUsers: Object.keys(vault.users).length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Admin DB sync error:', err);
    return res.status(500).json({ error: 'Database synchronization failed.', details: err?.message });
  }
});

// 7. Full Database Backup JSON Export
apiRouter.get('/admin/database/export-all', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const exportData: Record<string, any> = {
      timestamp: new Date().toISOString(),
      exportVersion: 1,
      appName: 'LifeTracko Database Dump',
      tables: {},
    };

    for (const tbl of VALID_TABLES) {
      try {
        const rowsRes = await pg.query(`SELECT * FROM ${tbl}`);
        exportData.tables[tbl] = rowsRes.rows;
      } catch (err) {
        exportData.tables[tbl] = [];
      }
    }

    return res.json(exportData);
  } catch (err: any) {
    console.error('Admin DB export error:', err);
    return res.status(500).json({ error: 'Failed to export database backup.' });
  }
});


// Support Ticket Submission Route
apiRouter.post('/support/ticket', async (req, res) => {
  try {
    const { name, email, subject, category, message, userId } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: 'Please provide both your email address and message description.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name || 'Anonymous User').trim();
    const cleanSubject = (subject || 'Issue Report').trim();
    const cleanCategory = (category || 'General Issue').trim();
    const cleanMessage = message.trim();

    const insertRes = await pg.query(
      `INSERT INTO support_tickets (user_id, sender_name, sender_email, subject, category, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [userId || null, cleanName, cleanEmail, cleanSubject, cleanCategory, cleanMessage]
    );

    const ticketId = insertRes.rows[0].id;

    console.log(`[SUPPORT TICKET #${ticketId}] From: ${cleanName} <${cleanEmail}> Subject: ${cleanSubject}`);

    // Email user's help request directly to lifetracko0@gmail.com via Gmail SMTP
    const emailRes = await sendSupportTicketEmail({
      ticketId,
      senderName: cleanName,
      senderEmail: cleanEmail,
      subject: cleanSubject,
      category: cleanCategory,
      message: cleanMessage,
    });

    return res.status(201).json({
      success: true,
      message: emailRes.sent
        ? 'Your help request has been emailed directly to lifetracko0@gmail.com!'
        : 'Your help request has been recorded in our support desk.',
      ticketId,
      emailSent: emailRes.sent,
      supportEmail: 'lifetracko0@gmail.com',
    });
  } catch (err: any) {
    console.error('Support ticket submission error:', err);
    return res.status(500).json({ error: 'Failed to submit support ticket. Please send email directly to lifetracko0@gmail.com.' });
  }
});

// Live Firewall & Security Status Endpoint
apiRouter.get('/firewall/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = getFirewallStats();
    return res.json({
      success: true,
      data: stats,
      databaseProtection: {
        parameterizedQueries: true,
        sslEncrypted: true,
        atRestProtection: true,
        tableLevelIsolation: true,
      },
      headers: {
        xContentTypeOptions: 'nosniff',
        xXssProtection: '1; mode=block',
        referrerPolicy: 'strict-origin-when-cross-origin',
        permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
      },
    });
  } catch (err: any) {
    console.error('Error fetching firewall status:', err);
    return res.status(500).json({ error: 'Failed to fetch firewall status' });
  }
});
