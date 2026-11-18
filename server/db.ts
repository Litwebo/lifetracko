import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { initPermanentAuthDb, syncPermanentDbWithPostgres } from './permanentAuthDb.ts';
import { initPermanentDataVault, syncDataVaultWithPostgres } from './permanentDataVault.ts';
import { pool as cloudSqlPool } from '../src/db/index.ts';

export const isCloudSqlEnabled = Boolean(process.env.SQL_HOST && process.env.SQL_USER);

const dataDir = path.join(process.cwd(), 'data', 'pgdata');
fs.mkdirSync(dataDir, { recursive: true });

let pgInstance: PGlite | null = null;
let pgInitPromise: Promise<PGlite> | null = null;

function cleanupStaleLocks(dir: string) {
  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.endsWith('.pid') || f.endsWith('.lock') || f.includes('postmaster.pid')) {
          try {
            fs.unlinkSync(path.join(dir, f));
            console.log(`Cleaned stale lock file: ${f}`);
          } catch {}
        }
      }
    }
  } catch {}
}

async function getPgInstance(): Promise<PGlite> {
  if (pgInstance) return pgInstance;
  if (pgInitPromise) return pgInitPromise;

  pgInitPromise = (async () => {
    cleanupStaleLocks(dataDir);

    try {
      const db = new PGlite(dataDir);
      if ((db as any).waitReady) {
        await (db as any).waitReady;
      }
      pgInstance = db;
      return db;
    } catch (err) {
      console.warn('PGlite persistent database initialization had lock or concurrency, retrying after lock cleanup...', err);
      cleanupStaleLocks(dataDir);

      try {
        const db = new PGlite(dataDir);
        if ((db as any).waitReady) {
          await (db as any).waitReady;
        }
        pgInstance = db;
        return db;
      } catch (retryErr) {
        console.error('PGlite persistent initialization error, utilizing memory fallback for this session while permanent credentials vault protects accounts:', retryErr);
        const db = new PGlite();
        if ((db as any).waitReady) {
          await (db as any).waitReady;
        }
        pgInstance = db;
        return db;
      }
    }
  })();

  return pgInitPromise;
}

export const pg = {
  query: async <T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }> => {
    if (isCloudSqlEnabled) {
      return cloudSqlPool.query(sql, params) as any;
    }
    const db = await getPgInstance();
    return db.query<T>(sql, params) as any;
  },
  exec: async (sql: string): Promise<any> => {
    if (isCloudSqlEnabled) {
      return cloudSqlPool.query(sql) as any;
    }
    const db = await getPgInstance();
    return db.exec(sql);
  },
  close: async (): Promise<void> => {
    if (isCloudSqlEnabled) {
      return;
    }
    if (pgInstance) {
      await pgInstance.close();
      pgInstance = null;
      pgInitPromise = null;
    }
  },
};

export async function initDb() {
  if (isCloudSqlEnabled) {
    console.log(`[Database] Linked to Cloud SQL PostgreSQL database (${process.env.SQL_DB_NAME}) in region asia-southeast1 via proxy.`);
  } else {
    console.log('Initializing local PostgreSQL database fallback...');
    await getPgInstance();
  }
  await initPermanentAuthDb();
  await initPermanentDataVault();

  // If using local database fallback, ensure tables and indexes exist
  if (!isCloudSqlEnabled) {
    // Create Users table
    await pg.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'MEMBER',
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        allow_admin_view BOOLEAN DEFAULT false,
        admin_access_decided BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migrate users columns in case table already exists
    await pg.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_admin_view BOOLEAN DEFAULT false;`);
    await pg.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_access_decided BOOLEAN DEFAULT false;`);

    // Create Foods table
    await pg.query(`
      CREATE TABLE IF NOT EXISTS foods (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        serving_size NUMERIC NOT NULL,
        serving_unit TEXT NOT NULL,
        calories NUMERIC NOT NULL,
        protein NUMERIC NOT NULL,
        category TEXT DEFAULT 'General',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Food Entries table
    await pg.query(`
      CREATE TABLE IF NOT EXISTS food_entries (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
        food_name TEXT NOT NULL,
        meal_type TEXT NOT NULL,
        quantity NUMERIC NOT NULL,
        unit TEXT NOT NULL,
        calories NUMERIC NOT NULL,
        protein NUMERIC NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Daily Nutrition table
    await pg.query(`
      CREATE TABLE IF NOT EXISTS daily_nutrition (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        total_calories NUMERIC NOT NULL DEFAULT 0,
        total_protein NUMERIC NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      );
    `);

    // Create Expenses table
    await pg.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Daily Money table
    await pg.query(`
      CREATE TABLE IF NOT EXISTS daily_money (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        starting_balance NUMERIC NOT NULL DEFAULT 0,
        total_spent NUMERIC NOT NULL DEFAULT 0,
        expected_ending_balance NUMERIC NOT NULL DEFAULT 0,
        actual_ending_balance NUMERIC,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      );
    `);

    // Create Nutrition Goals table
    await pg.query(`
      CREATE TABLE IF NOT EXISTS nutrition_goals (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        daily_calories NUMERIC NOT NULL DEFAULT 2200,
        daily_protein NUMERIC NOT NULL DEFAULT 120,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Password Reset Tokens table
    await pg.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT,
        code TEXT,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pg.query(`ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS code TEXT;`);
    await pg.query(`ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS email TEXT;`);

    // Create Body Weights table
    await pg.query(`
      CREATE TABLE IF NOT EXISTS body_weights (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        weight NUMERIC NOT NULL,
        unit TEXT NOT NULL DEFAULT 'kg',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      );
    `);

    // Create Support Tickets table
    await pg.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        sender_name TEXT NOT NULL,
        sender_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'General',
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Indexes
    await pg.query(`CREATE INDEX IF NOT EXISTS idx_food_entries_user_date ON food_entries(user_id, date);`);
    await pg.query(`CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);`);
    await pg.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await pg.query(`CREATE INDEX IF NOT EXISTS idx_body_weights_user_date ON body_weights(user_id, date);`);
    await pg.query(`CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);`);
  }

  // Synchronize Dedicated Permanent Auth Database with PostgreSQL
  await syncPermanentDbWithPostgres(pg);

  // Seed default Admin user safely if missing
  const adminEmail = (process.env.ADMIN_EMAIL || '1vinayak113@gmail.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'i@mvinayak#27';

  const existingAdmin = await pg.query(`SELECT id, password_hash FROM users WHERE email = $1`, [adminEmail]);
  if (existingAdmin.rows.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(adminPassword, salt);
    await pg.query(`
      INSERT INTO users (id, name, email, password_hash, role, status, allow_admin_view, admin_access_decided)
      VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVE', true, true)
      ON CONFLICT (id) DO UPDATE SET email = $3, role = 'ADMIN', status = 'ACTIVE'
    `, ['admin-root-001', 'Vinayak Admin', adminEmail, hash]);
    console.log(`Admin account initialized for ${adminEmail}`);
  } else {
    // Keep existing password hash intact (so password resets or updates persist permanently)
    await pg.query(`
      UPDATE users 
      SET role = 'ADMIN', status = 'ACTIVE', allow_admin_view = true, admin_access_decided = true
      WHERE email = $1
    `, [adminEmail]);
    console.log(`Admin account confirmed for ${adminEmail}`);
  }

  // Run another sync pass to guarantee permanent auth vault and PG are 100% matched
  await syncPermanentDbWithPostgres(pg);

  // Synchronize Dedicated Permanent User Data Vault (Diet, Food Entries, Expenses, Money) with PostgreSQL
  await syncDataVaultWithPostgres(pg);

  // Seed standard Food Database if empty
  const foodCount = await pg.query(`SELECT COUNT(*) as count FROM foods`);
  if (Number(foodCount.rows[0].count) === 0) {
    console.log('Seeding initial food database...');
    const seedFoods = [
      { name: 'Chicken Breast (Cooked)', size: 100, unit: 'grams', cal: 165, pro: 31, cat: 'Poultry' },
      { name: 'Grilled Chicken', size: 150, unit: 'grams', cal: 240, pro: 42, cat: 'Poultry' },
      { name: 'Boiled Egg (Large)', size: 1, unit: 'pieces', cal: 78, pro: 6.3, cat: 'Eggs & Dairy' },
      { name: 'Egg Whites', size: 3, unit: 'pieces', cal: 51, pro: 10.8, cat: 'Eggs & Dairy' },
      { name: 'Paneer (Cottage Cheese)', size: 100, unit: 'grams', cal: 265, pro: 18.3, cat: 'Eggs & Dairy' },
      { name: 'Greek Yogurt (Plain)', size: 150, unit: 'grams', cal: 130, pro: 15, cat: 'Eggs & Dairy' },
      { name: 'Whole Cow Milk', size: 250, unit: 'ml', cal: 150, pro: 8, cat: 'Eggs & Dairy' },
      { name: 'Whey Protein Scoop', size: 1, unit: 'serving', cal: 120, pro: 24, cat: 'Supplements' },
      { name: 'Brown Rice (Cooked)', size: 150, unit: 'grams', cal: 170, pro: 3.8, cat: 'Grains & Carbs' },
      { name: 'White Rice (Cooked)', size: 150, unit: 'grams', cal: 195, pro: 4.1, cat: 'Grains & Carbs' },
      { name: 'Roti / Chapati (Whole Wheat)', size: 1, unit: 'pieces', cal: 85, pro: 3.1, cat: 'Grains & Carbs' },
      { name: 'Oatmeal (Rolled Oats)', size: 50, unit: 'grams', cal: 190, pro: 6.5, cat: 'Grains & Carbs' },
      { name: 'Whole Wheat Bread Slice', size: 1, unit: 'pieces', cal: 75, pro: 3.5, cat: 'Grains & Carbs' },
      { name: 'Yellow Dal / Lentil Soup', size: 1, unit: 'cup', cal: 160, pro: 9, cat: 'Legumes' },
      { name: 'Boiled Chickpeas (Chana)', size: 100, unit: 'grams', cal: 164, pro: 8.9, cat: 'Legumes' },
      { name: 'Tofu (Firm)', size: 100, unit: 'grams', cal: 144, pro: 15.5, cat: 'Plant Protein' },
      { name: 'Salmon Fillet', size: 150, unit: 'grams', cal: 310, pro: 34, cat: 'Fish' },
      { name: 'Tuna (Canned in Water)', size: 100, unit: 'grams', cal: 116, pro: 26, cat: 'Fish' },
      { name: 'Banana (Medium)', size: 1, unit: 'pieces', cal: 105, pro: 1.3, cat: 'Fruits' },
      { name: 'Apple (Medium)', size: 1, unit: 'pieces', cal: 95, pro: 0.5, cat: 'Fruits' },
      { name: 'Orange', size: 1, unit: 'pieces', cal: 62, pro: 1.2, cat: 'Fruits' },
      { name: 'Almonds (Raw)', size: 30, unit: 'grams', cal: 175, pro: 6.3, cat: 'Nuts & Seeds' },
      { name: 'Peanut Butter', size: 2, unit: 'tablespoon', cal: 188, pro: 8, cat: 'Nuts & Seeds' },
      { name: 'Olive Oil', size: 1, unit: 'tablespoon', cal: 119, pro: 0, cat: 'Fats & Oils' },
      { name: 'Steamed Broccoli', size: 100, unit: 'grams', cal: 35, pro: 2.8, cat: 'Vegetables' },
      { name: 'Mixed Green Salad', size: 1, unit: 'serving', cal: 45, pro: 1.5, cat: 'Vegetables' },
      { name: 'Black Coffee (No Sugar)', size: 1, unit: 'cup', cal: 2, pro: 0.3, cat: 'Beverages' },
      { name: 'Green Tea', size: 1, unit: 'cup', cal: 2, pro: 0, cat: 'Beverages' },
    ];

    for (const f of seedFoods) {
      await pg.query(`
        INSERT INTO foods (name, serving_size, serving_unit, calories, protein, category)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [f.name, f.size, f.unit, f.cal, f.pro, f.cat]);
    }
  }

  // Seed sample member account if no members exist
  const existingMember = await pg.query(`SELECT id FROM users WHERE id = 'member-demo-001' OR email = 'alex@example.com'`);
  if (existingMember.rows.length === 0) {
    const demoMemberId = 'member-demo-001';
    const demoSalt = await bcrypt.genSalt(10);
    const demoHash = await bcrypt.hash('Member@2026', demoSalt);
    await pg.query(`
      INSERT INTO users (id, name, email, password_hash, role, status, allow_admin_view, admin_access_decided)
      VALUES ($1, $2, $3, $4, 'MEMBER', 'ACTIVE', true, true)
      ON CONFLICT (id) DO NOTHING
    `, [demoMemberId, 'Alex Sharma', 'alex@example.com', demoHash]);

    await pg.query(`
      INSERT INTO nutrition_goals (user_id, daily_calories, daily_protein)
      VALUES ($1, 2200, 125)
      ON CONFLICT (user_id) DO NOTHING
    `, [demoMemberId]);

    // Seed 3 days of realistic sample logs (yesterday, day before, today)
    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const todayStr = formatDate(now);
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayStr = formatDate(yesterday);
    const dayBefore = new Date(now.getTime() - 2 * 86400000);
    const dayBeforeStr = formatDate(dayBefore);

    // Body weights
    await pg.query(`
      INSERT INTO body_weights (user_id, date, weight, unit, notes)
      VALUES 
        ($1, $2, 74.8, 'kg', 'Morning, empty stomach'),
        ($1, $3, 75.2, 'kg', 'Post morning walk'),
        ($1, $4, 75.6, 'kg', 'Start of check-in')
      ON CONFLICT (user_id, date) DO NOTHING
    `, [demoMemberId, todayStr, yesterdayStr, dayBeforeStr]);

    // Food entries for today
    await pg.query(`
      INSERT INTO food_entries (user_id, date, food_name, meal_type, quantity, unit, calories, protein, notes)
      VALUES 
        ($1, $2, 'Boiled Egg (Large)', 'Breakfast', 3, 'pieces', 234, 18.9, 'Salt & pepper'),
        ($1, $2, 'Whole Wheat Bread Slice', 'Breakfast', 2, 'pieces', 150, 7.0, 'Toasted'),
        ($1, $2, 'Chicken Breast (Cooked)', 'Lunch', 200, 'grams', 330, 62.0, 'Herb grilled'),
        ($1, $2, 'Brown Rice (Cooked)', 'Lunch', 150, 'grams', 170, 3.8, 'Steamed'),
        ($1, $2, 'Banana (Medium)', 'Snack', 1, 'pieces', 105, 1.3, 'Post workout')
    `, [demoMemberId, todayStr]);

    await pg.query(`
      INSERT INTO daily_nutrition (user_id, date, total_calories, total_protein)
      VALUES ($1, $2, 989, 93)
    `, [demoMemberId, todayStr]);

    // Expenses for today
    await pg.query(`
      INSERT INTO expenses (user_id, date, description, category, amount, notes)
      VALUES 
        ($1, $2, 'Grocery & Fresh Chicken', 'Food', 450, 'Weekly protein stock'),
        ($1, $2, 'Metro Train Pass', 'Travel', 80, 'Daily commute'),
        ($1, $2, 'Espresso Coffee', 'Food', 120, 'Café work session')
    `, [demoMemberId, todayStr]);

    await pg.query(`
      INSERT INTO daily_money (user_id, date, starting_balance, total_spent, expected_ending_balance, actual_ending_balance)
      VALUES ($1, $2, 2500, 650, 1850, 1850)
    `, [demoMemberId, todayStr]);

    // Yesterday data
    await pg.query(`
      INSERT INTO food_entries (user_id, date, food_name, meal_type, quantity, unit, calories, protein, notes)
      VALUES 
        ($1, $2, 'Oatmeal (Rolled Oats)', 'Breakfast', 60, 'grams', 228, 7.8, 'With milk & berries'),
        ($1, $2, 'Greek Yogurt (Plain)', 'Breakfast', 150, 'grams', 130, 15.0, 'Unsweetened'),
        ($1, $2, 'Paneer (Cottage Cheese)', 'Lunch', 150, 'grams', 398, 27.5, 'Tawa paneer'),
        ($1, $2, 'Roti / Chapati (Whole Wheat)', 'Lunch', 3, 'pieces', 255, 9.3, 'Ghee brushed'),
        ($1, $2, 'Salmon Fillet', 'Dinner', 180, 'grams', 372, 40.8, 'Lemon garlic pan seared'),
        ($1, $2, 'Steamed Broccoli', 'Dinner', 150, 'grams', 53, 4.2, 'Lightly salted'),
        ($1, $2, 'Almonds (Raw)', 'Snack', 30, 'grams', 175, 6.3, 'Evening energy')
    `, [demoMemberId, yesterdayStr]);

    await pg.query(`
      INSERT INTO daily_nutrition (user_id, date, total_calories, total_protein)
      VALUES ($1, $2, 1611, 110.9)
    `, [demoMemberId, yesterdayStr]);

    await pg.query(`
      INSERT INTO expenses (user_id, date, description, category, amount, notes)
      VALUES 
        ($1, $2, 'Lunch with team', 'Food', 320, 'Healthy bowl'),
        ($1, $2, 'Fuel for vehicle', 'Travel', 500, 'Petrol station'),
        ($1, $2, 'Pharmacy multivitamin', 'Health', 350, 'Monthly supply')
    `, [demoMemberId, yesterdayStr]);

    await pg.query(`
      INSERT INTO daily_money (user_id, date, starting_balance, total_spent, expected_ending_balance, actual_ending_balance)
      VALUES ($1, $2, 3670, 1170, 2500, 2500)
    `, [demoMemberId, yesterdayStr]);

    // Day before yesterday data
    await pg.query(`
      INSERT INTO daily_nutrition (user_id, date, total_calories, total_protein)
      VALUES ($1, $2, 2145, 122)
    `, [demoMemberId, dayBeforeStr]);

    await pg.query(`
      INSERT INTO daily_money (user_id, date, starting_balance, total_spent, expected_ending_balance, actual_ending_balance)
      VALUES ($1, $2, 4500, 830, 3670, 3670)
    `, [demoMemberId, dayBeforeStr]);

    console.log('Sample demo member seeded: alex@example.com (Password: Member@2026)');
    await syncDataVaultWithPostgres(pg);
  }

  console.log('PostgreSQL database and Dedicated Permanent Data Vault ready.');
}
