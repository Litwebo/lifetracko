import fs from 'fs';
import path from 'path';

export interface PermanentFoodEntry {
  id: number;
  userId: string;
  date: string; // 'YYYY-MM-DD'
  foodId: number | null;
  foodName: string;
  mealType: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  notes: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface PermanentDailyNutrition {
  userId: string;
  date: string;
  totalCalories: number;
  totalProtein: number;
  updatedAt: string;
}

export interface PermanentExpense {
  id: number;
  userId: string;
  date: string; // 'YYYY-MM-DD'
  description: string;
  category: string;
  amount: number;
  notes: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface PermanentDailyMoney {
  userId: string;
  date: string;
  startingBalance: number;
  totalSpent: number;
  expectedEndingBalance: number;
  actualEndingBalance: number | null;
  updatedAt: string;
}

export interface PermanentBodyWeight {
  id: number;
  userId: string;
  date: string;
  weight: number;
  unit: string;
  notes: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface PermanentNutritionGoals {
  userId: string;
  dailyCalories: number;
  dailyProtein: number;
  updatedAt: string;
}

export interface UserVaultRecord {
  userId: string;
  email: string;
  foodEntries: PermanentFoodEntry[];
  dailyNutrition: Record<string, PermanentDailyNutrition>; // key is date
  expenses: PermanentExpense[];
  dailyMoney: Record<string, PermanentDailyMoney>; // key is date
  bodyWeights: PermanentBodyWeight[];
  nutritionGoals: PermanentNutritionGoals;
}

export interface PermanentDataVaultSchema {
  version: number;
  vaultName: string;
  createdAt: string;
  lastUpdated: string;
  users: Record<string, UserVaultRecord>; // key is userId or email
}

// Storage paths
const primaryDir = path.join(process.cwd(), 'data');
const primaryFile = path.join(primaryDir, 'user_data_permanent_vault.json');
const backupFile = path.join(primaryDir, 'user_data_permanent_vault.backup.json');
const rootVaultFile = path.join(process.cwd(), 'user_data_vault_permanent.json');

// In-memory working cache
let vaultCache: PermanentDataVaultSchema | null = null;

function ensureDirectoryExists() {
  try {
    if (!fs.existsSync(primaryDir)) {
      fs.mkdirSync(primaryDir, { recursive: true });
    }
  } catch (err) {
    console.error('Error creating data directory for permanent data vault:', err);
  }
}

function createEmptyVault(): PermanentDataVaultSchema {
  const now = new Date().toISOString();
  return {
    version: 1,
    vaultName: 'LifeTracko Dedicated Permanent User Data Vault',
    createdAt: now,
    lastUpdated: now,
    users: {},
  };
}

function flushVaultToDisk(vault: PermanentDataVaultSchema): void {
  ensureDirectoryExists();
  vault.lastUpdated = new Date().toISOString();
  const serialized = JSON.stringify(vault, null, 2);

  // 1. Primary write via atomic temp file
  const tempFile = path.join(primaryDir, `user_vault_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
  try {
    fs.writeFileSync(tempFile, serialized, 'utf8');
    fs.renameSync(tempFile, primaryFile);
  } catch (err) {
    console.error('Failed atomic write to primary user data vault:', err);
    try {
      fs.writeFileSync(primaryFile, serialized, 'utf8');
    } catch (directErr) {
      console.error('Failed direct write to primary user data vault:', directErr);
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
    console.warn('Warning: Failed to write user vault backup mirror:', backupErr);
  }

  // 3. Root vault mirror
  try {
    fs.writeFileSync(rootVaultFile, serialized, 'utf8');
  } catch (rootErr) {
    console.warn('Warning: Failed to write root user vault:', rootErr);
  }
}

function readVaultFile(filePath: string): PermanentDataVaultSchema | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return null;
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.users === 'object') {
      return parsed as PermanentDataVaultSchema;
    }
    return null;
  } catch (err) {
    console.warn(`Could not read vault file at ${filePath}:`, err);
    return null;
  }
}

export async function initPermanentDataVault(): Promise<PermanentDataVaultSchema> {
  if (vaultCache) return vaultCache;

  ensureDirectoryExists();

  let loaded = readVaultFile(primaryFile);
  if (!loaded) {
    console.log('[PermanentDataVault] Primary vault not found or empty, attempting backup recovery...');
    loaded = readVaultFile(backupFile);
  }
  if (!loaded) {
    console.log('[PermanentDataVault] Attempting root vault recovery...');
    loaded = readVaultFile(rootVaultFile);
  }

  if (!loaded) {
    console.log('[PermanentDataVault] Initializing fresh Dedicated Permanent User Data Vault...');
    loaded = createEmptyVault();
    flushVaultToDisk(loaded);
  } else {
    const userKeys = Object.keys(loaded.users);
    console.log(`[PermanentDataVault] Loaded permanent data vault with ${userKeys.length} user partitions.`);
  }

  vaultCache = loaded;
  return vaultCache;
}

function getOrCreateUserVault(userId: string, email?: string): UserVaultRecord {
  if (userId && userId.startsWith('demo-')) {
    // Ephemeral demo user - never stored in permanent data vault!
    return {
      userId,
      email: 'demo@lifetracko.app',
      foodEntries: [],
      dailyNutrition: {},
      expenses: [],
      dailyMoney: {},
      bodyWeights: [],
      nutritionGoals: {
        userId,
        dailyCalories: 2150,
        dailyProtein: 140,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  if (!vaultCache) {
    vaultCache = createEmptyVault();
  }

  // Check by userId first
  if (vaultCache.users[userId]) {
    if (email && !vaultCache.users[userId].email) {
      vaultCache.users[userId].email = email.toLowerCase().trim();
    }
    return vaultCache.users[userId];
  }

  // Check by email
  if (email) {
    const normEmail = email.toLowerCase().trim();
    for (const record of Object.values(vaultCache.users)) {
      if (record.email && record.email.toLowerCase().trim() === normEmail) {
        // Map userId to this record
        record.userId = userId;
        vaultCache.users[userId] = record;
        return record;
      }
    }
  }

  const now = new Date().toISOString();
  const newRecord: UserVaultRecord = {
    userId,
    email: email ? email.toLowerCase().trim() : '',
    foodEntries: [],
    dailyNutrition: {},
    expenses: [],
    dailyMoney: {},
    bodyWeights: [],
    nutritionGoals: {
      userId,
      dailyCalories: 2200,
      dailyProtein: 120,
      updatedAt: now,
    },
  };

  vaultCache.users[userId] = newRecord;
  return newRecord;
}

// ----------------------------------------------------
// DIET & FOOD ENTRIES PERMANENT VAULT OPERATIONS
// ----------------------------------------------------

export async function vaultSaveFoodEntry(userId: string, entry: PermanentFoodEntry, email?: string): Promise<void> {
  const vault = await initPermanentDataVault();
  const userVault = getOrCreateUserVault(userId, email);

  const idx = userVault.foodEntries.findIndex((f) => f.id === entry.id);
  if (idx >= 0) {
    userVault.foodEntries[idx] = { ...userVault.foodEntries[idx], ...entry, updatedAt: new Date().toISOString() };
  } else {
    userVault.foodEntries.push({ ...entry, updatedAt: new Date().toISOString() });
  }

  flushVaultToDisk(vault);
  console.log(`[PermanentDataVault] Permanently saved food entry #${entry.id} (${entry.foodName}) for user ${userId}`);
}

export async function vaultDeleteFoodEntry(userId: string, entryId: number): Promise<void> {
  const vault = await initPermanentDataVault();
  const userVault = getOrCreateUserVault(userId);

  const initialLen = userVault.foodEntries.length;
  userVault.foodEntries = userVault.foodEntries.filter((f) => f.id !== entryId);

  if (userVault.foodEntries.length !== initialLen) {
    flushVaultToDisk(vault);
    console.log(`[PermanentDataVault] Permanently removed food entry #${entryId} for user ${userId}`);
  }
}

export async function vaultSaveDailyNutrition(
  userId: string,
  date: string,
  totalCalories: number,
  totalProtein: number,
  email?: string
): Promise<void> {
  const vault = await initPermanentDataVault();
  const userVault = getOrCreateUserVault(userId, email);

  userVault.dailyNutrition[date] = {
    userId,
    date,
    totalCalories,
    totalProtein,
    updatedAt: new Date().toISOString(),
  };

  flushVaultToDisk(vault);
}

// ----------------------------------------------------
// EXPENSES & MONEY PERMANENT VAULT OPERATIONS
// ----------------------------------------------------

export async function vaultSaveExpense(userId: string, expense: PermanentExpense, email?: string): Promise<void> {
  const vault = await initPermanentDataVault();
  const userVault = getOrCreateUserVault(userId, email);

  const idx = userVault.expenses.findIndex((e) => e.id === expense.id);
  if (idx >= 0) {
    userVault.expenses[idx] = { ...userVault.expenses[idx], ...expense, updatedAt: new Date().toISOString() };
  } else {
    userVault.expenses.push({ ...expense, updatedAt: new Date().toISOString() });
  }

  flushVaultToDisk(vault);
  console.log(`[PermanentDataVault] Permanently saved expense #${expense.id} (₹${expense.amount} - ${expense.description}) for user ${userId}`);
}

export async function vaultDeleteExpense(userId: string, expenseId: number): Promise<void> {
  const vault = await initPermanentDataVault();
  const userVault = getOrCreateUserVault(userId);

  const initialLen = userVault.expenses.length;
  userVault.expenses = userVault.expenses.filter((e) => e.id !== expenseId);

  if (userVault.expenses.length !== initialLen) {
    flushVaultToDisk(vault);
    console.log(`[PermanentDataVault] Permanently removed expense #${expenseId} for user ${userId}`);
  }
}

export async function vaultSaveDailyMoney(userId: string, date: string, money: PermanentDailyMoney, email?: string): Promise<void> {
  const vault = await initPermanentDataVault();
  const userVault = getOrCreateUserVault(userId, email);

  userVault.dailyMoney[date] = {
    ...money,
    userId,
    date,
    updatedAt: new Date().toISOString(),
  };

  flushVaultToDisk(vault);
  console.log(`[PermanentDataVault] Permanently saved daily money for ${date} (Start: ₹${money.startingBalance}, Spent: ₹${money.totalSpent}) for user ${userId}`);
}

// ----------------------------------------------------
// BODY WEIGHT & GOALS PERMANENT VAULT OPERATIONS
// ----------------------------------------------------

export async function vaultSaveBodyWeight(userId: string, weight: PermanentBodyWeight, email?: string): Promise<void> {
  const vault = await initPermanentDataVault();
  const userVault = getOrCreateUserVault(userId, email);

  const idx = userVault.bodyWeights.findIndex((w) => w.id === weight.id || (w.date === weight.date && w.userId === userId));
  if (idx >= 0) {
    userVault.bodyWeights[idx] = { ...userVault.bodyWeights[idx], ...weight, updatedAt: new Date().toISOString() };
  } else {
    userVault.bodyWeights.push({ ...weight, updatedAt: new Date().toISOString() });
  }

  flushVaultToDisk(vault);
}

export async function vaultDeleteBodyWeight(userId: string, weightId: number): Promise<void> {
  const vault = await initPermanentDataVault();
  const userVault = getOrCreateUserVault(userId);

  userVault.bodyWeights = userVault.bodyWeights.filter((w) => w.id !== weightId);
  flushVaultToDisk(vault);
}

export async function vaultDeleteUserData(userId: string, email?: string): Promise<boolean> {
  const vault = await initPermanentDataVault();
  const targetId = (userId || '').trim();
  const targetEmail = (email || '').toLowerCase().trim();
  let deleted = false;

  for (const [key, record] of Object.entries(vault.users)) {
    const keyNorm = key.toLowerCase().trim();
    const recordEmailNorm = (record.email || '').toLowerCase().trim();
    const recordUserId = (record.userId || '').trim();

    if (
      key === targetId ||
      keyNorm === targetEmail ||
      recordUserId === targetId ||
      recordUserId === targetEmail ||
      (targetEmail && recordEmailNorm === targetEmail) ||
      (targetId && recordEmailNorm === targetId.toLowerCase())
    ) {
      delete vault.users[key];
      deleted = true;
      console.log(`[PermanentDataVault] Purged user vault record "${key}" (userId: ${recordUserId}, email: ${recordEmailNorm})`);
    }
  }

  if (deleted) {
    flushVaultToDisk(vault);
    console.log(`[PermanentDataVault] Permanently purged all vaulted records for user ID ${userId} (${email || ''})`);
  }

  return deleted;
}

export async function vaultSaveNutritionGoals(userId: string, dailyCalories: number, dailyProtein: number, email?: string): Promise<void> {
  const vault = await initPermanentDataVault();
  const userVault = getOrCreateUserVault(userId, email);

  userVault.nutritionGoals = {
    userId,
    dailyCalories,
    dailyProtein,
    updatedAt: new Date().toISOString(),
  };

  flushVaultToDisk(vault);
}

// ----------------------------------------------------
// BIDIRECTIONAL SYNC WITH POSTGRESQL
// ----------------------------------------------------

export async function syncDataVaultWithPostgres(pg: any): Promise<{
  restoredFoodEntries: number;
  restoredExpenses: number;
  restoredDailyMoney: number;
  restoredNutrition: number;
  syncedFromPgToVault: number;
}> {
  const vault = await initPermanentDataVault();

  let restoredFoodEntries = 0;
  let restoredExpenses = 0;
  let restoredDailyMoney = 0;
  let restoredNutrition = 0;
  let syncedFromPgToVault = 0;

  try {
    // 1. REHYDRATE POSTGRES FROM THE PERMANENT DATA VAULT
    for (const [userId, userVault] of Object.entries(vault.users)) {
      if (!userId) continue;

      // Goals
      if (userVault.nutritionGoals) {
        try {
          await pg.query(
            `INSERT INTO nutrition_goals (user_id, daily_calories, daily_protein, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id) DO UPDATE 
             SET daily_calories = $2, daily_protein = $3, updated_at = CURRENT_TIMESTAMP`,
            [userId, userVault.nutritionGoals.dailyCalories || 2200, userVault.nutritionGoals.dailyProtein || 120]
          );
        } catch {}
      }

      // Food entries
      for (const entry of userVault.foodEntries) {
        try {
          const res = await pg.query(
            `INSERT INTO food_entries (id, user_id, date, food_id, food_name, meal_type, quantity, unit, calories, protein, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (id) DO UPDATE
             SET user_id = $2, date = $3, food_name = $5, meal_type = $6, quantity = $7, unit = $8, calories = $9, protein = $10, notes = $11, updated_at = $13`,
            [
              entry.id,
              entry.userId || userId,
              entry.date,
              entry.foodId || null,
              entry.foodName,
              entry.mealType,
              entry.quantity,
              entry.unit,
              entry.calories,
              entry.protein,
              entry.notes || '',
              entry.createdAt || new Date().toISOString(),
              entry.updatedAt || new Date().toISOString(),
            ]
          );
          if (res) restoredFoodEntries++;
        } catch (foodErr) {
          // If foreign key constraint or collision, try without explicit ID
          try {
            await pg.query(
              `INSERT INTO food_entries (user_id, date, food_name, meal_type, quantity, unit, calories, protein, notes)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                entry.userId || userId,
                entry.date,
                entry.foodName,
                entry.mealType,
                entry.quantity,
                entry.unit,
                entry.calories,
                entry.protein,
                entry.notes || '',
              ]
            );
          } catch {}
        }
      }

      // Daily Nutrition
      for (const [date, nut] of Object.entries(userVault.dailyNutrition)) {
        try {
          await pg.query(
            `INSERT INTO daily_nutrition (user_id, date, total_calories, total_protein, updated_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, date) DO UPDATE
             SET total_calories = $3, total_protein = $4, updated_at = CURRENT_TIMESTAMP`,
            [userId, date, nut.totalCalories, nut.totalProtein]
          );
          restoredNutrition++;
        } catch {}
      }

      // Expenses
      for (const exp of userVault.expenses) {
        try {
          const res = await pg.query(
            `INSERT INTO expenses (id, user_id, date, description, category, amount, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE
             SET user_id = $2, date = $3, description = $4, category = $5, amount = $6, notes = $7, updated_at = $9`,
            [
              exp.id,
              exp.userId || userId,
              exp.date,
              exp.description,
              exp.category,
              exp.amount,
              exp.notes || '',
              exp.createdAt || new Date().toISOString(),
              exp.updatedAt || new Date().toISOString(),
            ]
          );
          if (res) restoredExpenses++;
        } catch (expErr) {
          try {
            await pg.query(
              `INSERT INTO expenses (user_id, date, description, category, amount, notes)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [exp.userId || userId, exp.date, exp.description, exp.category, exp.amount, exp.notes || '']
            );
          } catch {}
        }
      }

      // Daily Money
      for (const [date, dm] of Object.entries(userVault.dailyMoney)) {
        try {
          await pg.query(
            `INSERT INTO daily_money (user_id, date, starting_balance, total_spent, expected_ending_balance, actual_ending_balance, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, date) DO UPDATE
             SET starting_balance = $3, total_spent = $4, expected_ending_balance = $5, actual_ending_balance = $6, updated_at = CURRENT_TIMESTAMP`,
            [userId, date, dm.startingBalance, dm.totalSpent, dm.expectedEndingBalance, dm.actualEndingBalance]
          );
          restoredDailyMoney++;
        } catch {}
      }

      // Body weights
      for (const bw of userVault.bodyWeights) {
        try {
          await pg.query(
            `INSERT INTO body_weights (id, user_id, date, weight, unit, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (user_id, date) DO UPDATE
             SET weight = $4, unit = $5, notes = $6, updated_at = $8`,
            [
              bw.id,
              bw.userId || userId,
              bw.date,
              bw.weight,
              bw.unit || 'kg',
              bw.notes || '',
              bw.createdAt || new Date().toISOString(),
              bw.updatedAt || new Date().toISOString(),
            ]
          );
        } catch {}
      }
    }

    // Adjust PostgreSQL serial sequences so new inserts don't collide
    try {
      await pg.query(`SELECT setval('food_entries_id_seq', COALESCE((SELECT MAX(id) FROM food_entries), 1) + 1, false);`);
      await pg.query(`SELECT setval('expenses_id_seq', COALESCE((SELECT MAX(id) FROM expenses), 1) + 1, false);`);
      await pg.query(`SELECT setval('body_weights_id_seq', COALESCE((SELECT MAX(id) FROM body_weights), 1) + 1, false);`);
    } catch (seqErr) {
      console.warn('[PermanentDataVault] Notice setting sequence values:', seqErr);
    }

    // 2. DISCOVER ANY RECORDS IN POSTGRESQL NOT YET IN VAULT AND ARCHIVE THEM
    try {
      const allFoods = await pg.query(
        `SELECT id, user_id, date, food_id, food_name, meal_type, quantity, unit, calories, protein, notes, created_at
         FROM food_entries`
      );
      for (const row of allFoods.rows) {
        const uVault = getOrCreateUserVault(row.user_id);
        if (!uVault.foodEntries.some((f) => f.id === row.id)) {
          uVault.foodEntries.push({
            id: row.id,
            userId: row.user_id,
            date: row.date,
            foodId: row.food_id,
            foodName: row.food_name,
            mealType: row.meal_type,
            quantity: Number(row.quantity),
            unit: row.unit,
            calories: Number(row.calories),
            protein: Number(row.protein),
            notes: row.notes,
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          });
          syncedFromPgToVault++;
        }
      }

      const allExpenses = await pg.query(
        `SELECT id, user_id, date, description, category, amount, notes, created_at
         FROM expenses`
      );
      for (const row of allExpenses.rows) {
        const uVault = getOrCreateUserVault(row.user_id);
        if (!uVault.expenses.some((e) => e.id === row.id)) {
          uVault.expenses.push({
            id: row.id,
            userId: row.user_id,
            date: row.date,
            description: row.description,
            category: row.category,
            amount: Number(row.amount),
            notes: row.notes,
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          });
          syncedFromPgToVault++;
        }
      }

      const allMoney = await pg.query(
        `SELECT user_id, date, starting_balance, total_spent, expected_ending_balance, actual_ending_balance
         FROM daily_money`
      );
      for (const row of allMoney.rows) {
        const uVault = getOrCreateUserVault(row.user_id);
        uVault.dailyMoney[row.date] = {
          userId: row.user_id,
          date: row.date,
          startingBalance: Number(row.starting_balance),
          totalSpent: Number(row.total_spent),
          expectedEndingBalance: Number(row.expected_ending_balance),
          actualEndingBalance: row.actual_ending_balance !== null ? Number(row.actual_ending_balance) : null,
          updatedAt: new Date().toISOString(),
        };
      }

      const allNutrition = await pg.query(
        `SELECT user_id, date, total_calories, total_protein FROM daily_nutrition`
      );
      for (const row of allNutrition.rows) {
        const uVault = getOrCreateUserVault(row.user_id);
        uVault.dailyNutrition[row.date] = {
          userId: row.user_id,
          date: row.date,
          totalCalories: Number(row.total_calories),
          totalProtein: Number(row.total_protein),
          updatedAt: new Date().toISOString(),
        };
      }

      const allWeights = await pg.query(
        `SELECT id, user_id, date, weight, unit, notes, created_at FROM body_weights`
      );
      for (const row of allWeights.rows) {
        const uVault = getOrCreateUserVault(row.user_id);
        if (!uVault.bodyWeights.some((w) => w.id === row.id)) {
          uVault.bodyWeights.push({
            id: row.id,
            userId: row.user_id,
            date: row.date,
            weight: Number(row.weight),
            unit: row.unit,
            notes: row.notes,
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          });
        }
      }

      if (syncedFromPgToVault > 0) {
        flushVaultToDisk(vault);
        console.log(`[PermanentDataVault] Backed up ${syncedFromPgToVault} new records from Postgres to permanent disk vault.`);
      }
    } catch (archiveErr) {
      console.warn('[PermanentDataVault] Notice archiving Postgres records:', archiveErr);
    }
  } catch (syncErr) {
    console.error('[PermanentDataVault] Synchronization error:', syncErr);
  }

  console.log(
    `[PermanentDataVault] Sync complete. Restored: ${restoredFoodEntries} foods, ${restoredExpenses} expenses, ${restoredDailyMoney} money logs.`
  );

  return {
    restoredFoodEntries,
    restoredExpenses,
    restoredDailyMoney,
    restoredNutrition,
    syncedFromPgToVault,
  };
}

// ----------------------------------------------------
// USER STATS & AUDIT LOG
// ----------------------------------------------------

export function getUserVaultStats(userId: string, email?: string) {
  if (!vaultCache) return null;

  let uVault = vaultCache.users[userId];
  if (!uVault && email) {
    const norm = email.toLowerCase().trim();
    for (const record of Object.values(vaultCache.users)) {
      if (record.email && record.email.toLowerCase().trim() === norm) {
        uVault = record;
        break;
      }
    }
  }

  if (!uVault) {
    return {
      userId,
      email: email || '',
      totalFoodsVaulted: 0,
      totalExpensesVaulted: 0,
      totalDaysTracked: 0,
      totalWeightLogs: 0,
      vaultStatus: 'ACTIVE_AND_SYNCHRONIZED',
      lastUpdated: vaultCache.lastUpdated,
      isZeroLossProtected: true,
    };
  }

  const allDates = new Set<string>();
  uVault.foodEntries.forEach((f) => allDates.add(f.date));
  uVault.expenses.forEach((e) => allDates.add(e.date));
  Object.keys(uVault.dailyMoney).forEach((d) => allDates.add(d));
  Object.keys(uVault.dailyNutrition).forEach((d) => allDates.add(d));

  return {
    userId: uVault.userId,
    email: uVault.email || email || '',
    totalFoodsVaulted: uVault.foodEntries.length,
    totalExpensesVaulted: uVault.expenses.length,
    totalDaysTracked: allDates.size,
    totalWeightLogs: uVault.bodyWeights.length,
    vaultStatus: 'ACTIVE_AND_SYNCHRONIZED',
    lastUpdated: vaultCache.lastUpdated,
    isZeroLossProtected: true,
  };
}

export function getAllVaultStats() {
  const usersCount = vaultCache ? Object.keys(vaultCache.users).length : 0;
  let totalFoods = 0;
  let totalExpenses = 0;

  if (vaultCache) {
    for (const u of Object.values(vaultCache.users)) {
      totalFoods += u.foodEntries.length;
      totalExpenses += u.expenses.length;
    }
  }

  return {
    vaultName: 'LifeTracko Dedicated Permanent User Data Vault',
    status: 'ACTIVE_AND_PERMANENT',
    primaryPath: primaryFile,
    backupPath: backupFile,
    rootPath: rootVaultFile,
    totalUsersVaulted: usersCount,
    totalFoodsVaulted: totalFoods,
    totalExpensesVaulted: totalExpenses,
    lastUpdated: vaultCache?.lastUpdated || null,
  };
}
