import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export interface PermanentUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'INACTIVE';
  allowAdminView: boolean;
  adminAccessDecided: boolean;
  dailyCalories: number;
  dailyProtein: number;
  createdAt: string;
  updatedAt: string;
}

interface PermanentDatabaseSchema {
  version: number;
  databaseName: string;
  createdAt: string;
  lastUpdated: string;
  users: Record<string, PermanentUserRecord>; // key is normalized email
}

// Separate permanent storage paths
const primaryDir = path.join(process.cwd(), 'data');
const primaryFile = path.join(primaryDir, 'auth_permanent_database.json');
const backupFile = path.join(primaryDir, 'auth_permanent_database.backup.json');
const rootVaultFile = path.join(process.cwd(), 'auth_vault_permanent.json');

// In-memory working cache
let dbCache: PermanentDatabaseSchema | null = null;

function ensureDirectoryExists() {
  try {
    if (!fs.existsSync(primaryDir)) {
      fs.mkdirSync(primaryDir, { recursive: true });
    }
  } catch (err) {
    console.error('Error creating data directory for permanent auth db:', err);
  }
}

function createEmptyDatabase(): PermanentDatabaseSchema {
  const now = new Date().toISOString();
  return {
    version: 1,
    databaseName: 'LifeTracko Dedicated Permanent Auth Database',
    createdAt: now,
    lastUpdated: now,
    users: {},
  };
}

function flushDatabaseToDisk(db: PermanentDatabaseSchema): void {
  ensureDirectoryExists();
  db.lastUpdated = new Date().toISOString();
  const serialized = JSON.stringify(db, null, 2);

  // 1. Atomic write to primary database
  const tempFile = path.join(primaryDir, `auth_db_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
  try {
    fs.writeFileSync(tempFile, serialized, 'utf8');
    fs.renameSync(tempFile, primaryFile);
  } catch (err) {
    console.error('Failed atomic write to primary auth database:', err);
    // Fallback direct write
    try {
      fs.writeFileSync(primaryFile, serialized, 'utf8');
    } catch (directErr) {
      console.error('Failed direct write to primary auth database:', directErr);
    }
  } finally {
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch {}
  }

  // 2. Redundant mirror backup
  try {
    fs.writeFileSync(backupFile, serialized, 'utf8');
  } catch (backupErr) {
    console.warn('Warning: Failed to update backup mirror:', backupErr);
  }

  // 3. Redundant root-level vault file
  try {
    fs.writeFileSync(rootVaultFile, serialized, 'utf8');
  } catch (rootErr) {
    console.warn('Warning: Failed to update root vault file:', rootErr);
  }
}

function readDatabaseFile(filePath: string): PermanentDatabaseSchema | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return null;
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.users === 'object') {
      return parsed as PermanentDatabaseSchema;
    }
    return null;
  } catch (err) {
    console.warn(`Could not read database file at ${filePath}:`, err);
    return null;
  }
}

export async function initPermanentAuthDb(): Promise<PermanentDatabaseSchema> {
  if (dbCache) return dbCache;

  ensureDirectoryExists();

  // Try primary, then backup, then root vault
  let loaded = readDatabaseFile(primaryFile);
  if (!loaded) {
    console.log('[PermanentAuthDb] Primary database not found or corrupted, attempting backup recovery...');
    loaded = readDatabaseFile(backupFile);
  }
  if (!loaded) {
    console.log('[PermanentAuthDb] Attempting root vault recovery...');
    loaded = readDatabaseFile(rootVaultFile);
  }

  if (!loaded) {
    console.log('[PermanentAuthDb] Initializing fresh Dedicated Permanent Auth Database...');
    loaded = createEmptyDatabase();
  } else {
    console.log(`[PermanentAuthDb] Loaded ${Object.keys(loaded.users).length} existing permanent user accounts.`);
  }

  dbCache = loaded;

  // Ensure default Administrator is permanently registered
  const adminEmail = (process.env.ADMIN_EMAIL || '1vinayak113@gmail.com').toLowerCase().trim();
  const existingAdmin = dbCache.users[adminEmail];

  if (!existingAdmin) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'i@mvinayak#27';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(adminPassword, salt);
    const now = new Date().toISOString();

    dbCache.users[adminEmail] = {
      id: 'admin-root-001',
      name: 'Vinayak Admin',
      email: adminEmail,
      passwordHash: hash,
      role: 'ADMIN',
      status: 'ACTIVE',
      allowAdminView: true,
      adminAccessDecided: true,
      dailyCalories: 2200,
      dailyProtein: 120,
      createdAt: now,
      updatedAt: now,
    };
    flushDatabaseToDisk(dbCache);
    console.log(`[PermanentAuthDb] Initialized permanent Admin credentials for ${adminEmail}`);
  }

  return dbCache;
}

export function getPermanentUserByEmail(email: string): PermanentUserRecord | null {
  if (!dbCache) return null;
  const key = email.toLowerCase().trim();
  return dbCache.users[key] || null;
}

export function getPermanentUserById(id: string): PermanentUserRecord | null {
  if (!dbCache) return null;
  for (const user of Object.values(dbCache.users)) {
    if (user.id === id) return user;
  }
  return null;
}

export function getAllPermanentUsers(): PermanentUserRecord[] {
  if (!dbCache) return [];
  return Object.values(dbCache.users);
}

export async function savePermanentUser(user: Omit<PermanentUserRecord, 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
  updatedAt?: string;
}): Promise<PermanentUserRecord> {
  const db = await initPermanentAuthDb();
  const emailKey = user.email.toLowerCase().trim();
  const existing = db.users[emailKey];
  const now = new Date().toISOString();

  const record: PermanentUserRecord = {
    id: user.id || existing?.id || `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: user.name.trim(),
    email: emailKey,
    passwordHash: user.passwordHash,
    role: user.role,
    status: user.status || 'ACTIVE',
    allowAdminView: user.allowAdminView ?? existing?.allowAdminView ?? false,
    adminAccessDecided: user.adminAccessDecided ?? existing?.adminAccessDecided ?? false,
    dailyCalories: user.dailyCalories || existing?.dailyCalories || 2200,
    dailyProtein: user.dailyProtein || existing?.dailyProtein || 120,
    createdAt: existing?.createdAt || user.createdAt || now,
    updatedAt: now,
  };

  db.users[emailKey] = record;
  flushDatabaseToDisk(db);
  console.log(`[PermanentAuthDb] Successfully saved permanent credentials for user: ${emailKey}`);
  return record;
}

export async function updatePermanentUserPassword(emailOrId: string, newPasswordHash: string): Promise<boolean> {
  const db = await initPermanentAuthDb();
  const normalized = emailOrId.toLowerCase().trim();

  let targetKey: string | null = null;
  if (db.users[normalized]) {
    targetKey = normalized;
  } else {
    for (const [key, user] of Object.entries(db.users)) {
      if (user.id === emailOrId) {
        targetKey = key;
        break;
      }
    }
  }

  if (!targetKey || !db.users[targetKey]) {
    console.warn(`[PermanentAuthDb] User not found for password update: ${emailOrId}`);
    return false;
  }

  db.users[targetKey].passwordHash = newPasswordHash;
  db.users[targetKey].updatedAt = new Date().toISOString();
  flushDatabaseToDisk(db);
  console.log(`[PermanentAuthDb] Permanently updated password for: ${targetKey}`);
  return true;
}

export async function updatePermanentUserStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<boolean> {
  const db = await initPermanentAuthDb();
  for (const user of Object.values(db.users)) {
    if (user.id === id) {
      user.status = status;
      user.updatedAt = new Date().toISOString();
      flushDatabaseToDisk(db);
      return true;
    }
  }
  return false;
}

export async function deletePermanentUser(idOrEmail: string, optionalEmail?: string): Promise<boolean> {
  const db = await initPermanentAuthDb();
  const targetId = (idOrEmail || '').trim();
  const targetEmail = (optionalEmail || idOrEmail || '').toLowerCase().trim();
  let deletedCount = 0;

  for (const [key, user] of Object.entries(db.users)) {
    const keyNorm = key.toLowerCase().trim();
    const userEmailNorm = (user.email || '').toLowerCase().trim();
    const userId = (user.id || '').trim();

    if (
      keyNorm === targetEmail ||
      keyNorm === targetId.toLowerCase() ||
      userEmailNorm === targetEmail ||
      userEmailNorm === targetId.toLowerCase() ||
      userId === targetId ||
      userId === targetEmail
    ) {
      delete db.users[key];
      deletedCount++;
      console.log(`[PermanentAuthDb] Deleted user record (${key}) matching ID/email: ${targetId} / ${targetEmail}`);
    }
  }

  if (deletedCount > 0) {
    flushDatabaseToDisk(db);
    return true;
  }
  return false;
}

export async function syncPermanentDbWithPostgres(pg: any): Promise<{
  syncedToPg: number;
  syncedFromPg: number;
  totalPermanentUsers: number;
}> {
  const db = await initPermanentAuthDb();
  let syncedToPg = 0;
  let syncedFromPg = 0;

  try {
    // 1. Ensure all permanent users exist in Postgres
    for (const user of Object.values(db.users)) {
      try {
        const existing = await pg.query(`SELECT id, password_hash FROM users WHERE email = $1`, [user.email]);
        if (existing.rows.length === 0) {
          await pg.query(
            `INSERT INTO users (id, name, email, password_hash, role, status, allow_admin_view, admin_access_decided, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO UPDATE 
             SET email = $3, password_hash = $4, role = $5, status = $6, updated_at = $10`,
            [
              user.id,
              user.name,
              user.email,
              user.passwordHash,
              user.role,
              user.status,
              user.allowAdminView,
              user.adminAccessDecided,
              user.createdAt,
              user.updatedAt,
            ]
          );

          await pg.query(
            `INSERT INTO nutrition_goals (user_id, daily_calories, daily_protein)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id) DO NOTHING`,
            [user.id, user.dailyCalories || 2200, user.dailyProtein || 120]
          );

          syncedToPg++;
        } else {
          // If password in permanent db differs from PG, update PG
          const pgHash = existing.rows[0].password_hash;
          if (pgHash !== user.passwordHash) {
            await pg.query(
              `UPDATE users SET password_hash = $1, role = $2, status = $3, updated_at = $4 WHERE email = $5`,
              [user.passwordHash, user.role, user.status, user.updatedAt, user.email]
            );
            syncedToPg++;
          }
        }
      } catch (userSyncErr) {
        console.warn(`[PermanentAuthDb] Notice syncing user ${user.email} to Postgres:`, userSyncErr);
      }
    }

    // 2. Discover any users in Postgres that are not yet in permanent database
    try {
      const pgUsers = await pg.query(
        `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.status, u.allow_admin_view, u.admin_access_decided, u.created_at, u.updated_at,
                g.daily_calories, g.daily_protein
         FROM users u
         LEFT JOIN nutrition_goals g ON u.id = g.user_id`
      );

      for (const row of pgUsers.rows) {
        const normEmail = (row.email || '').toLowerCase().trim();
        if (normEmail && !db.users[normEmail]) {
          db.users[normEmail] = {
            id: row.id,
            name: row.name || 'Member',
            email: normEmail,
            passwordHash: row.password_hash,
            role: row.role || 'MEMBER',
            status: row.status || 'ACTIVE',
            allowAdminView: Boolean(row.allow_admin_view),
            adminAccessDecided: Boolean(row.admin_access_decided),
            dailyCalories: Number(row.daily_calories || 2200),
            dailyProtein: Number(row.daily_protein || 120),
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
          };
          syncedFromPg++;
        }
      }

      if (syncedFromPg > 0) {
        flushDatabaseToDisk(db);
      }
    } catch (pgFetchErr) {
      console.warn('[PermanentAuthDb] Notice reading Postgres users for sync:', pgFetchErr);
    }
  } catch (err) {
    console.error('[PermanentAuthDb] Sync error:', err);
  }

  const total = Object.keys(db.users).length;
  console.log(`[PermanentAuthDb] Synchronization complete: ${total} permanent accounts verified.`);
  return { syncedToPg, syncedFromPg, totalPermanentUsers: total };
}

export function getPermanentDbStats() {
  const usersCount = dbCache ? Object.keys(dbCache.users).length : 0;
  return {
    status: 'ACTIVE_AND_PERMANENT',
    databaseType: 'Dedicated Permanent Auth & Credentials Vault',
    primaryStoragePath: primaryFile,
    backupMirrorPath: backupFile,
    rootVaultPath: rootVaultFile,
    isPersistedToDisk: fs.existsSync(primaryFile),
    isBackupAvailable: fs.existsSync(backupFile),
    totalAccounts: usersCount,
    lastUpdated: dbCache?.lastUpdated || null,
  };
}
