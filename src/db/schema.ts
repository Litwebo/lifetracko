import { pgTable, text, serial, numeric, boolean, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  uid: text('uid').unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('MEMBER'),
  status: text('status').notNull().default('ACTIVE'),
  allowAdminView: boolean('allow_admin_view').default(false),
  adminAccessDecided: boolean('admin_access_decided').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Pre-defined Foods catalog
export const foods = pgTable('foods', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  servingSize: numeric('serving_size').notNull(),
  servingUnit: text('serving_unit').notNull(),
  calories: numeric('calories').notNull(),
  protein: numeric('protein').notNull(),
  category: text('category').default('General'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Food entries logged by user
export const foodEntries = pgTable('food_entries', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  foodId: integer('food_id').references(() => foods.id, { onDelete: 'set null' }),
  foodName: text('food_name').notNull(),
  mealType: text('meal_type').notNull(),
  quantity: numeric('quantity').notNull(),
  unit: text('unit').notNull(),
  calories: numeric('calories').notNull(),
  protein: numeric('protein').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Daily aggregated nutrition
export const dailyNutrition = pgTable('daily_nutrition', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  totalCalories: numeric('total_calories').notNull().default('0'),
  totalProtein: numeric('total_protein').notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Expenses logged by user
export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  amount: numeric('amount').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Daily cash ledger & balance audit
export const dailyMoney = pgTable('daily_money', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  startingBalance: numeric('starting_balance').notNull().default('0'),
  totalSpent: numeric('total_spent').notNull().default('0'),
  expectedEndingBalance: numeric('expected_ending_balance').notNull().default('0'),
  actualEndingBalance: numeric('actual_ending_balance'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Daily nutrition goals
export const nutritionGoals = pgTable('nutrition_goals', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  dailyCalories: numeric('daily_calories').notNull().default('2200'),
  dailyProtein: numeric('daily_protein').notNull().default('120'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Body weights tracking
export const bodyWeights = pgTable('body_weights', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  weight: numeric('weight').notNull(),
  unit: text('unit').notNull().default('kg'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Password reset tokens & verification codes
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  email: text('email'),
  code: text('code'),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Support tickets
export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  senderName: text('sender_name').notNull(),
  senderEmail: text('sender_email').notNull(),
  subject: text('subject').notNull(),
  category: text('category').notNull().default('General'),
  message: text('message').notNull(),
  status: text('status').notNull().default('OPEN'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  foodEntries: many(foodEntries),
  dailyNutrition: many(dailyNutrition),
  expenses: many(expenses),
  dailyMoney: many(dailyMoney),
  bodyWeights: many(bodyWeights),
  nutritionGoal: one(nutritionGoals, {
    fields: [users.id],
    references: [nutritionGoals.userId],
  }),
}));

export const foodEntriesRelations = relations(foodEntries, ({ one }) => ({
  user: one(users, {
    fields: [foodEntries.userId],
    references: [users.id],
  }),
  food: one(foods, {
    fields: [foodEntries.foodId],
    references: [foods.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
}));
