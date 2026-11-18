export type Role = 'ADMIN' | 'MEMBER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt?: string;
  dailyCalories?: number;
  dailyProtein?: number;
  allowAdminView?: boolean;
  adminAccessDecided?: boolean;
  isDemo?: boolean;
}

export interface BodyWeight {
  id: number;
  userId: string;
  date: string; // YYYY-MM-DD
  weight: number;
  unit: 'kg' | 'lbs';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export type FoodUnit =
  | 'grams'
  | 'ml'
  | 'pieces'
  | 'serving'
  | 'cup'
  | 'tablespoon'
  | 'teaspoon';

export interface Food {
  id: number;
  name: string;
  servingSize: number;
  servingUnit: FoodUnit;
  calories: number;
  protein: number;
  category?: string;
}

export interface FoodEntry {
  id: number;
  userId: string;
  date: string; // YYYY-MM-DD
  foodId?: number | null;
  foodName: string;
  mealType: MealType;
  quantity: number;
  unit: FoodUnit;
  calories: number;
  protein: number;
  notes?: string;
  createdAt: string;
}

export type ExpenseCategory =
  | 'Food'
  | 'Travel'
  | 'Shopping'
  | 'Education'
  | 'Entertainment'
  | 'Bills'
  | 'Health'
  | 'Other';

export interface Expense {
  id: number;
  userId: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: ExpenseCategory;
  amount: number;
  notes?: string;
  createdAt: string;
}

export interface DailyNutrition {
  id?: number;
  userId: string;
  date: string;
  totalCalories: number;
  totalProtein: number;
  targetCalories?: number;
  targetProtein?: number;
}

export interface DailyMoney {
  id?: number;
  userId: string;
  date: string;
  startingBalance: number;
  totalSpent: number;
  expectedEndingBalance: number;
  remainingBalance?: number;
  actualEndingBalance: number | null;
  actualBalance?: number | null;
  difference?: number | null;
}

export interface NutritionGoals {
  dailyCalories: number;
  dailyProtein: number;
}

export interface DailySummary {
  date: string;
  nutrition: {
    totalCalories: number;
    totalProtein: number;
    goalCalories: number;
    goalProtein: number;
    mealsCount: number;
  };
  weight?: {
    id?: number;
    weight: number;
    unit: string;
    notes?: string;
  } | null;
  money: {
    startingBalance: number;
    totalSpent: number;
    expectedEndingBalance: number;
    actualEndingBalance: number | null;
    difference: number | null;
    isVerified: boolean;
    expensesCount: number;
  };
}

export interface DayHistoryItem {
  date: string;
  totalCalories: number;
  totalProtein: number;
  startingBalance: number;
  totalSpent: number;
  expectedEndingBalance: number;
  actualEndingBalance: number | null;
  hasNutrition: boolean;
  hasMoney: boolean;
}

export interface AnalyticsOverview {
  stats: {
    avgCalories: number;
    avgProtein: number;
    avgDailyExpense: number;
    daysCount: number;
  };
  nutritionTrend: Array<{
    date: string;
    calories: number;
    protein: number;
  }>;
  spendingTrend: Array<{
    date: string;
    spent: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    total: number;
  }>;
}

export interface AnalyticsSummary {
  range: string;
  avgCalories: number;
  avgProtein: number;
  totalSpending: number;
  avgDailySpending: number;
  highestSpendingDay: { date: string; amount: number } | null;
  lowestSpendingDay: { date: string; amount: number } | null;
  dailyTrend: Array<{
    date: string;
    calories: number;
    protein: number;
    spending: number;
    goalCalories: number;
    goalProtein: number;
  }>;
  categorySpending: Array<{
    category: ExpenseCategory;
    amount: number;
    percentage: number;
  }>;
}

export interface MemberOverview {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  foodEntriesCount: number;
  expensesCount: number;
  weightsCount?: number;
  dailyCalories?: number;
  dailyProtein?: number;
  dailyCaloriesGoal?: number;
  dailyProteinGoal?: number;
  allowAdminView?: boolean;
  adminAccessDecided?: boolean;
}

export interface MemberAdminView extends MemberOverview {
  dailyCaloriesGoal: number;
  dailyProteinGoal: number;
}

export interface AdminStats {
  totalMembers: number;
  activeMembers: number;
  newMembersToday?: number;
  totalFoodEntries: number;
  totalExpenses: number;
  totalMoneyTracked?: number;
  totalMoneyVolume?: number;
}

export interface DbTableInfo {
  name: string;
  label: string;
  rowCount: number;
  description: string;
}

export interface DbTableData {
  table: string;
  columns: string[];
  rows: Record<string, any>[];
  totalCount: number;
  page: number;
  limit: number;
}

export interface DbQueryResult {
  success: boolean;
  rows: Record<string, any>[];
  columns: string[];
  rowCount: number;
  executionTimeMs: number;
  command?: string;
  error?: string;
}
