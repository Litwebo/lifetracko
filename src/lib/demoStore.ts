import { User, FoodEntry, Expense, DailyNutrition, DailyMoney, BodyWeight } from '../types.ts';
import { getTodayDateString } from './utils.ts';

const DEMO_ACTIVE_KEY = 'lifetrack_demo_active';
const DEMO_DATA_KEY = 'lifetrack_demo_data';
const DEMO_USER_KEY = 'lifetrack_demo_user';

export interface DemoStoreData {
  user: User;
  foodEntries: FoodEntry[];
  expenses: Expense[];
  dailyNutrition: Record<string, DailyNutrition>;
  dailyMoney: Record<string, DailyMoney>;
  weights: BodyWeight[];
}

// Generate past date string (YYYY-MM-DD)
function getPastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createInitialDemoData(): DemoStoreData {
  const today = getTodayDateString();
  const d1 = getPastDate(1);
  const d2 = getPastDate(2);
  const d3 = getPastDate(3);
  const d4 = getPastDate(4);
  const d5 = getPastDate(5);
  const d6 = getPastDate(6);

  const demoUser: User = {
    id: 'demo-member-ephemeral-session',
    name: 'Demo Member',
    email: 'demo.member@lifetracko.app',
    role: 'MEMBER', // Strictly MEMBER, not Admin
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    dailyCalories: 2150,
    dailyProtein: 140,
    allowAdminView: false,
    adminAccessDecided: true,
    isDemo: true,
  };

  const foodEntries: FoodEntry[] = [
    // Today's Meals
    {
      id: 101,
      userId: demoUser.id,
      date: today,
      foodName: 'Rolled Oats with Berries & Almond Butter',
      mealType: 'Breakfast',
      quantity: 1,
      unit: 'serving',
      calories: 380,
      protein: 14,
      notes: 'High fiber morning meal',
      createdAt: `${today}T08:15:00Z`,
    },
    {
      id: 102,
      userId: demoUser.id,
      date: today,
      foodName: 'Greek Yogurt with Raw Honey & Walnuts',
      mealType: 'Snack',
      quantity: 150,
      unit: 'grams',
      calories: 210,
      protein: 18,
      notes: 'Mid-morning snack',
      createdAt: `${today}T11:00:00Z`,
    },
    {
      id: 103,
      userId: demoUser.id,
      date: today,
      foodName: 'Grilled Herb Chicken with Brown Rice & Broccoli',
      mealType: 'Lunch',
      quantity: 1,
      unit: 'serving',
      calories: 590,
      protein: 52,
      notes: 'Post-workout nutritious lunch',
      createdAt: `${today}T13:30:00Z`,
    },
    {
      id: 104,
      userId: demoUser.id,
      date: today,
      foodName: 'Whey Protein Isolate Shake',
      mealType: 'Snack',
      quantity: 1,
      unit: 'serving',
      calories: 140,
      protein: 28,
      notes: 'Afternoon recovery',
      createdAt: `${today}T17:00:00Z`,
    },

    // Yesterday's Meals (d1)
    {
      id: 201,
      userId: demoUser.id,
      date: d1,
      foodName: 'Scrambled Eggs with Avocado Toast',
      mealType: 'Breakfast',
      quantity: 2,
      unit: 'pieces',
      calories: 420,
      protein: 24,
      createdAt: `${d1}T08:30:00Z`,
    },
    {
      id: 202,
      userId: demoUser.id,
      date: d1,
      foodName: 'Chicken Burrito Bowl with Beans & Guacamole',
      mealType: 'Lunch',
      quantity: 1,
      unit: 'serving',
      calories: 680,
      protein: 48,
      createdAt: `${d1}T13:15:00Z`,
    },
    {
      id: 203,
      userId: demoUser.id,
      date: d1,
      foodName: 'Salmon Fillet with Sweet Potatoes & Asparagus',
      mealType: 'Dinner',
      quantity: 1,
      unit: 'serving',
      calories: 550,
      protein: 44,
      createdAt: `${d1}T20:00:00Z`,
    },

    // d2 Meals
    {
      id: 301,
      userId: demoUser.id,
      date: d2,
      foodName: 'Protein Smoothie with Spinach & Banana',
      mealType: 'Breakfast',
      quantity: 1,
      unit: 'serving',
      calories: 340,
      protein: 30,
      createdAt: `${d2}T08:00:00Z`,
    },
    {
      id: 302,
      userId: demoUser.id,
      date: d2,
      foodName: 'Paneer Tikka with Whole Wheat Roti',
      mealType: 'Lunch',
      quantity: 1,
      unit: 'serving',
      calories: 610,
      protein: 36,
      createdAt: `${d2}T13:45:00Z`,
    },
    {
      id: 303,
      userId: demoUser.id,
      date: d2,
      foodName: 'Tofu & Vegetable Stir-Fry',
      mealType: 'Dinner',
      quantity: 1,
      unit: 'serving',
      calories: 480,
      protein: 32,
      createdAt: `${d2}T19:30:00Z`,
    },
  ];

  const expenses: Expense[] = [
    // Today's Expenses
    {
      id: 1001,
      userId: demoUser.id,
      date: today,
      description: 'Morning Specialty Brew Coffee & Bagel',
      category: 'Food',
      amount: 240,
      notes: 'Local cafe',
      createdAt: `${today}T08:45:00Z`,
    },
    {
      id: 1002,
      userId: demoUser.id,
      date: today,
      description: 'Metro Smart Card Pass Recharge',
      category: 'Travel',
      amount: 150,
      notes: 'Daily commute',
      createdAt: `${today}T09:30:00Z`,
    },
    {
      id: 1003,
      userId: demoUser.id,
      date: today,
      description: 'Weekly Organic Groceries & Fresh Produce',
      category: 'Shopping',
      amount: 980,
      notes: 'Supermarket visit',
      createdAt: `${today}T15:20:00Z`,
    },

    // Yesterday's Expenses (d1)
    {
      id: 1004,
      userId: demoUser.id,
      date: d1,
      description: 'Healthy Lunch with Team',
      category: 'Food',
      amount: 450,
      createdAt: `${d1}T13:50:00Z`,
    },
    {
      id: 1005,
      userId: demoUser.id,
      date: d1,
      description: 'Cab Ride to Client Meeting',
      category: 'Travel',
      amount: 280,
      createdAt: `${d1}T16:10:00Z`,
    },
    {
      id: 1006,
      userId: demoUser.id,
      date: d1,
      description: 'Audiobook & Learning Subscription',
      category: 'Education',
      amount: 499,
      createdAt: `${d1}T19:00:00Z`,
    },

    // d2 Expenses
    {
      id: 1007,
      userId: demoUser.id,
      date: d2,
      description: 'Monthly Gym & Fitness Center Pass',
      category: 'Health',
      amount: 1500,
      createdAt: `${d2}T07:15:00Z`,
    },
    {
      id: 1008,
      userId: demoUser.id,
      date: d2,
      description: 'Pharmacy Multivitamins & Omega-3',
      category: 'Health',
      amount: 620,
      createdAt: `${d2}T18:00:00Z`,
    },

    // d3 Expenses
    {
      id: 1009,
      userId: demoUser.id,
      date: d3,
      description: 'High-speed Fiber Internet Monthly Bill',
      category: 'Bills',
      amount: 899,
      createdAt: `${d3}T10:00:00Z`,
    },
  ];

  const dailyNutrition: Record<string, DailyNutrition> = {
    [today]: {
      userId: demoUser.id,
      date: today,
      totalCalories: 1320,
      totalProtein: 112,
      targetCalories: 2150,
      targetProtein: 140,
    },
    [d1]: {
      userId: demoUser.id,
      date: d1,
      totalCalories: 1650,
      totalProtein: 116,
      targetCalories: 2150,
      targetProtein: 140,
    },
    [d2]: {
      userId: demoUser.id,
      date: d2,
      totalCalories: 1430,
      totalProtein: 98,
      targetCalories: 2150,
      targetProtein: 140,
    },
    [d3]: {
      userId: demoUser.id,
      date: d3,
      totalCalories: 1950,
      totalProtein: 132,
      targetCalories: 2150,
      targetProtein: 140,
    },
    [d4]: {
      userId: demoUser.id,
      date: d4,
      totalCalories: 2080,
      totalProtein: 138,
      targetCalories: 2150,
      targetProtein: 140,
    },
    [d5]: {
      userId: demoUser.id,
      date: d5,
      totalCalories: 1850,
      totalProtein: 125,
      targetCalories: 2150,
      targetProtein: 140,
    },
    [d6]: {
      userId: demoUser.id,
      date: d6,
      totalCalories: 2100,
      totalProtein: 142,
      targetCalories: 2150,
      targetProtein: 140,
    },
  };

  const dailyMoney: Record<string, DailyMoney> = {
    [today]: {
      userId: demoUser.id,
      date: today,
      startingBalance: 12000,
      totalSpent: 1370,
      expectedEndingBalance: 10630,
      remainingBalance: 10630,
      actualEndingBalance: null,
      actualBalance: null,
      difference: null,
    },
    [d1]: {
      userId: demoUser.id,
      date: d1,
      startingBalance: 13500,
      totalSpent: 1229,
      expectedEndingBalance: 12271,
      remainingBalance: 12271,
      actualEndingBalance: 12270,
      actualBalance: 12270,
      difference: -1,
    },
    [d2]: {
      userId: demoUser.id,
      date: d2,
      startingBalance: 16000,
      totalSpent: 2120,
      expectedEndingBalance: 13880,
      remainingBalance: 13880,
      actualEndingBalance: 13880,
      actualBalance: 13880,
      difference: 0,
    },
    [d3]: {
      userId: demoUser.id,
      date: d3,
      startingBalance: 17500,
      totalSpent: 899,
      expectedEndingBalance: 16601,
      remainingBalance: 16601,
      actualEndingBalance: 16600,
      actualBalance: 16600,
      difference: -1,
    },
  };

  const weights: BodyWeight[] = [
    {
      id: 501,
      userId: demoUser.id,
      date: today,
      weight: 68.2,
      unit: 'kg',
      notes: 'Morning weigh-in after wake up',
      createdAt: `${today}T07:00:00Z`,
    },
    {
      id: 502,
      userId: demoUser.id,
      date: d2,
      weight: 68.5,
      unit: 'kg',
      createdAt: `${d2}T07:05:00Z`,
    },
    {
      id: 503,
      userId: demoUser.id,
      date: d4,
      weight: 68.9,
      unit: 'kg',
      createdAt: `${d4}T07:10:00Z`,
    },
    {
      id: 504,
      userId: demoUser.id,
      date: d6,
      weight: 69.3,
      unit: 'kg',
      createdAt: `${d6}T07:00:00Z`,
    },
  ];

  return {
    user: demoUser,
    foodEntries,
    expenses,
    dailyNutrition,
    dailyMoney,
    weights,
  };
}

export function isDemoSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(DEMO_ACTIVE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function getDemoData(): DemoStoreData {
  if (typeof window === 'undefined') return createInitialDemoData();
  try {
    const raw = sessionStorage.getItem(DEMO_DATA_KEY);
    if (!raw) {
      const initial = createInitialDemoData();
      sessionStorage.setItem(DEMO_DATA_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return createInitialDemoData();
  }
}

export function saveDemoData(data: DemoStoreData): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(DEMO_DATA_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save ephemeral demo data to sessionStorage:', err);
  }
}

export function startDemoSession(): User {
  const initial = createInitialDemoData();
  sessionStorage.setItem(DEMO_ACTIVE_KEY, 'true');
  sessionStorage.setItem(DEMO_DATA_KEY, JSON.stringify(initial));
  sessionStorage.setItem(DEMO_USER_KEY, JSON.stringify(initial.user));
  // Note: we do NOT touch localStorage 'lifetrack_jwt' or permanent databases!
  return initial.user;
}

export function endDemoSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(DEMO_ACTIVE_KEY);
    sessionStorage.removeItem(DEMO_DATA_KEY);
    sessionStorage.removeItem(DEMO_USER_KEY);
  } catch {
    // ignore
  }
}

// Recalculate daily nutrition totals for a date
function recalcNutrition(store: DemoStoreData, date: string) {
  const entries = store.foodEntries.filter((f) => f.date === date);
  const totalCalories = entries.reduce((acc, cur) => acc + (Number(cur.calories) || 0), 0);
  const totalProtein = entries.reduce((acc, cur) => acc + (Number(cur.protein) || 0), 0);

  const prev = store.dailyNutrition[date];
  store.dailyNutrition[date] = {
    userId: store.user.id,
    date,
    totalCalories,
    totalProtein,
    targetCalories: prev?.targetCalories || store.user.dailyCalories || 2150,
    targetProtein: prev?.targetProtein || store.user.dailyProtein || 140,
  };

  return store.dailyNutrition[date];
}

// Recalculate daily money totals for a date
function recalcMoney(store: DemoStoreData, date: string) {
  const exps = store.expenses.filter((e) => e.date === date);
  const totalSpent = exps.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);

  const prev = store.dailyMoney[date] || {
    startingBalance: 10000,
    actualEndingBalance: null,
    actualBalance: null,
  };

  const startingBalance = Number(prev.startingBalance || 0);
  const expectedEndingBalance = startingBalance - totalSpent;
  const actualEndingBalance = prev.actualEndingBalance ?? null;
  const difference =
    actualEndingBalance !== null ? actualEndingBalance - expectedEndingBalance : null;

  store.dailyMoney[date] = {
    userId: store.user.id,
    date,
    startingBalance,
    totalSpent,
    expectedEndingBalance,
    remainingBalance: expectedEndingBalance,
    actualEndingBalance,
    actualBalance: actualEndingBalance,
    difference,
  };

  return store.dailyMoney[date];
}

// Intercept handler for all mock API calls during Demo session
export function handleDemoApiCall(url: string, init?: RequestInit): Response | null {
  if (!isDemoSession()) return null;

  const parsedUrl = new URL(url, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const method = (init?.method || 'GET').toUpperCase();

  // Block any attempt to access Admin endpoints in Demo Mode
  if (pathname.startsWith('/api/admin')) {
    return new Response(
      JSON.stringify({
        error: 'Administrator access is disabled in Demo Mode. Demo accounts are restricted exclusively to Member access.',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const store = getDemoData();

  // 1. Current User Profile
  if (pathname === '/api/auth/me' && method === 'GET') {
    return new Response(
      JSON.stringify({ user: store.user }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Demo Logout / Exit
  if (pathname === '/api/auth/logout' && method === 'POST') {
    endDemoSession();
    return new Response(
      JSON.stringify({ success: true, message: 'Demo session ended and temporary data wiped.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. User Admin Access privacy toggle
  if (pathname === '/api/user/admin-access' && method === 'PUT') {
    try {
      const body = JSON.parse((init?.body as string) || '{}');
      store.user.allowAdminView = Boolean(body.allowAdminView);
      store.user.adminAccessDecided = true;
      saveDemoData(store);
      return new Response(
        JSON.stringify({
          success: true,
          message: store.user.allowAdminView ? 'Demo data shared with admin' : 'Demo data set to private',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 4. Diet by Day
  const dietDayMatch = pathname.match(/^\/api\/diet\/day\/([^/]+)$/);
  if (dietDayMatch && method === 'GET') {
    const date = dietDayMatch[1];
    const nutrition = recalcNutrition(store, date);
    const entries = store.foodEntries.filter((f) => f.date === date);
    saveDemoData(store);
    return new Response(
      JSON.stringify({ nutrition, entries }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 5. Diet Root (GET / POST)
  if (pathname === '/api/diet') {
    if (method === 'GET') {
      const date = parsedUrl.searchParams.get('date') || getTodayDateString();
      const nutrition = recalcNutrition(store, date);
      const entries = store.foodEntries.filter((f) => f.date === date);
      saveDemoData(store);
      return new Response(
        JSON.stringify({ nutrition, entries }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}');
      const newEntry: FoodEntry = {
        id: Date.now(),
        userId: store.user.id,
        date: body.date || getTodayDateString(),
        foodId: body.foodId || null,
        foodName: body.foodName || 'Meal Entry',
        mealType: body.mealType || 'Breakfast',
        quantity: Number(body.quantity) || 1,
        unit: body.unit || 'serving',
        calories: Number(body.calories) || 0,
        protein: Number(body.protein) || 0,
        notes: body.notes || '',
        createdAt: new Date().toISOString(),
      };

      store.foodEntries.unshift(newEntry);
      const nutrition = recalcNutrition(store, newEntry.date);
      saveDemoData(store);

      return new Response(
        JSON.stringify({ entry: newEntry, nutrition }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // 6. Diet Entry Edit / Delete
  const dietIdMatch = pathname.match(/^\/api\/diet\/(\d+)$/);
  if (dietIdMatch) {
    const id = Number(dietIdMatch[1]);
    const entryIdx = store.foodEntries.findIndex((f) => f.id === id);

    if (method === 'PUT') {
      if (entryIdx !== -1) {
        const body = JSON.parse((init?.body as string) || '{}');
        const updated = { ...store.foodEntries[entryIdx], ...body };
        store.foodEntries[entryIdx] = updated;
        const nutrition = recalcNutrition(store, updated.date);
        saveDemoData(store);
        return new Response(
          JSON.stringify({ entry: updated, nutrition }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (method === 'DELETE') {
      if (entryIdx !== -1) {
        const deleted = store.foodEntries.splice(entryIdx, 1)[0];
        const nutrition = recalcNutrition(store, deleted.date);
        saveDemoData(store);
        return new Response(
          JSON.stringify({ success: true, nutrition }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  // 7. Expenses by Day
  const expDayMatch = pathname.match(/^\/api\/expenses\/day\/([^/]+)$/);
  if (expDayMatch && method === 'GET') {
    const date = expDayMatch[1];
    const money = recalcMoney(store, date);
    const expenses = store.expenses.filter((e) => e.date === date);
    saveDemoData(store);
    return new Response(
      JSON.stringify({ money, expenses }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 8. Expenses Root (GET / POST)
  if (pathname === '/api/expenses') {
    if (method === 'GET') {
      const date = parsedUrl.searchParams.get('date') || getTodayDateString();
      const money = recalcMoney(store, date);
      const expenses = store.expenses.filter((e) => e.date === date);
      saveDemoData(store);
      return new Response(
        JSON.stringify({ money, expenses }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}');
      const newExpense: Expense = {
        id: Date.now(),
        userId: store.user.id,
        date: body.date || getTodayDateString(),
        description: body.description || 'Expense',
        category: body.category || 'Other',
        amount: Number(body.amount) || 0,
        notes: body.notes || '',
        createdAt: new Date().toISOString(),
      };

      store.expenses.unshift(newExpense);
      const money = recalcMoney(store, newExpense.date);
      saveDemoData(store);

      return new Response(
        JSON.stringify({ expense: newExpense, money }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // 9. Expense Edit / Delete
  const expIdMatch = pathname.match(/^\/api\/expenses\/(\d+)$/);
  if (expIdMatch) {
    const id = Number(expIdMatch[1]);
    const expIdx = store.expenses.findIndex((e) => e.id === id);

    if (method === 'PUT') {
      if (expIdx !== -1) {
        const body = JSON.parse((init?.body as string) || '{}');
        const updated = { ...store.expenses[expIdx], ...body };
        store.expenses[expIdx] = updated;
        const money = recalcMoney(store, updated.date);
        saveDemoData(store);
        return new Response(
          JSON.stringify({ expense: updated, money }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (method === 'DELETE') {
      if (expIdx !== -1) {
        const deleted = store.expenses.splice(expIdx, 1)[0];
        const money = recalcMoney(store, deleted.date);
        saveDemoData(store);
        return new Response(
          JSON.stringify({ success: true, money }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  // 10. Starting Balance
  if (
    (pathname === '/api/money/starting-balance' || pathname === '/api/expenses/balance/starting') &&
    method === 'POST'
  ) {
    const body = JSON.parse((init?.body as string) || '{}');
    const date = body.date || getTodayDateString();
    const current = store.dailyMoney[date] || recalcMoney(store, date);
    current.startingBalance = Number(body.amount ?? body.startingBalance ?? 0);
    const updated = recalcMoney(store, date);
    saveDemoData(store);
    return new Response(
      JSON.stringify({ money: updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 11. Actual Balance
  if (
    (pathname === '/api/money/actual-balance' || pathname === '/api/expenses/balance/actual') &&
    method === 'POST'
  ) {
    const body = JSON.parse((init?.body as string) || '{}');
    const date = body.date || getTodayDateString();
    const current = store.dailyMoney[date] || recalcMoney(store, date);
    current.actualEndingBalance = Number(body.amount ?? body.actualBalance ?? 0);
    const updated = recalcMoney(store, date);
    saveDemoData(store);
    return new Response(
      JSON.stringify({ money: updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 12. Body Weight
  if (pathname === '/api/weight') {
    if (method === 'GET') {
      const date = parsedUrl.searchParams.get('date');
      if (date) {
        const found = store.weights.find((w) => w.date === date) || null;
        return new Response(
          JSON.stringify(found),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify(store.weights),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}');
      const newWeight: BodyWeight = {
        id: Date.now(),
        userId: store.user.id,
        date: body.date || getTodayDateString(),
        weight: Number(body.weight) || 0,
        unit: body.unit || 'kg',
        notes: body.notes || '',
        createdAt: new Date().toISOString(),
      };

      // Replace or insert
      const existingIdx = store.weights.findIndex((w) => w.date === newWeight.date);
      if (existingIdx !== -1) {
        store.weights[existingIdx] = newWeight;
      } else {
        store.weights.unshift(newWeight);
      }
      saveDemoData(store);
      return new Response(
        JSON.stringify(newWeight),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Weight History
  if (pathname === '/api/weight/history' && method === 'GET') {
    return new Response(
      JSON.stringify(store.weights),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 13. Daily Summary
  if (pathname === '/api/daily-summary' && method === 'GET') {
    const date = parsedUrl.searchParams.get('date') || getTodayDateString();
    const nutrition = recalcNutrition(store, date);
    const money = recalcMoney(store, date);
    const weight = store.weights.find((w) => w.date === date) || null;

    return new Response(
      JSON.stringify({
        date,
        nutrition: {
          totalCalories: nutrition.totalCalories,
          totalProtein: nutrition.totalProtein,
          goalCalories: nutrition.targetCalories || 2150,
          goalProtein: nutrition.targetProtein || 140,
        },
        money: {
          startingBalance: money.startingBalance,
          totalSpent: money.totalSpent,
          expectedEndingBalance: money.expectedEndingBalance,
          actualEndingBalance: money.actualEndingBalance,
          difference: money.difference,
        },
        weight: weight?.weight || null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 14. History Overview
  if (pathname.startsWith('/api/history') && method === 'GET') {
    // Collect all unique dates from dailyNutrition and dailyMoney
    const allDates = Array.from(
      new Set([
        ...Object.keys(store.dailyNutrition),
        ...Object.keys(store.dailyMoney),
        ...store.foodEntries.map((f) => f.date),
        ...store.expenses.map((e) => e.date),
      ])
    ).sort((a, b) => b.localeCompare(a));

    const historyItems = allDates.map((date) => {
      const nut = recalcNutrition(store, date);
      const mon = recalcMoney(store, date);
      const wt = store.weights.find((w) => w.date === date);
      return {
        date,
        totalCalories: nut.totalCalories,
        totalProtein: nut.totalProtein,
        calorieGoal: nut.targetCalories || 2150,
        proteinGoal: nut.targetProtein || 140,
        startingBalance: mon.startingBalance,
        totalSpent: mon.totalSpent,
        expectedEndingBalance: mon.expectedEndingBalance,
        actualEndingBalance: mon.actualEndingBalance,
        difference: mon.difference,
        weight: wt?.weight ?? null,
      };
    });

    return new Response(
      JSON.stringify({
        overview: historyItems,
        nutritionHistory: historyItems,
        moneyHistory: historyItems,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 15. Analytics Overview
  if (pathname.startsWith('/api/analytics') && method === 'GET') {
    // Compute total expense category breakdown
    const categoryTotals: Record<string, number> = {};
    for (const exp of store.expenses) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + Number(exp.amount);
    }

    const totalSpent = store.expenses.reduce((acc, cur) => acc + Number(cur.amount), 0);
    const avgDailySpend = Math.round(totalSpent / 7);

    const analyticsData = {
      summary: {
        totalCaloriesTracked: Object.values(store.dailyNutrition).reduce(
          (acc, cur) => acc + cur.totalCalories,
          0
        ),
        totalProteinTracked: Object.values(store.dailyNutrition).reduce(
          (acc, cur) => acc + cur.totalProtein,
          0
        ),
        totalExpensesTracked: totalSpent,
        avgDailyCalories: 1850,
        avgDailyProtein: 124,
        avgDailyExpenses: avgDailySpend,
      },
      categoryBreakdown: Object.entries(categoryTotals).map(([name, amount]) => ({
        name,
        amount,
        percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
      })),
      weeklyTrends: Object.keys(store.dailyNutrition)
        .slice(0, 7)
        .map((date) => ({
          date,
          calories: store.dailyNutrition[date].totalCalories,
          protein: store.dailyNutrition[date].totalProtein,
          spent: store.dailyMoney[date]?.totalSpent || 0,
        })),
    };

    return new Response(
      JSON.stringify(analyticsData),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 16. Profile update
  if ((pathname === '/api/profile' || pathname === '/api/user/profile') && method === 'PUT') {
    const body = JSON.parse((init?.body as string) || '{}');
    if (body.name) store.user.name = body.name;
    if (body.dailyCalories) store.user.dailyCalories = Number(body.dailyCalories);
    if (body.dailyProtein) store.user.dailyProtein = Number(body.dailyProtein);
    saveDemoData(store);
    return new Response(
      JSON.stringify({ user: store.user, message: 'Demo profile updated temporarily.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 17. Vault status endpoint
  if (pathname === '/api/user/permanent-vault-status') {
    return new Response(
      JSON.stringify({
        inDemoMode: true,
        vaultStatus: 'Demo Mode — Ephemeral Session Only. No permanent vault records stored.',
        totalRecords: 0,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Allow other calls (like GET /api/foods) to pass through to real read-only server
  return null;
}

// Global interceptor installation
let isInterceptorInstalled = false;

export function installDemoInterceptor(): void {
  if (typeof window === 'undefined' || isInterceptorInstalled) return;

  try {
    const rawFetch = window.fetch ? window.fetch.bind(window) : undefined;
    if (rawFetch) {
      const interceptedFetch = async function (
        this: any,
        input: RequestInfo | URL,
        init?: RequestInit
      ): Promise<Response> {
        try {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

          if (isDemoSession() && url.includes('/api/')) {
            const mockResponse = handleDemoApiCall(url, init);
            if (mockResponse) {
              return mockResponse;
            }
          }
        } catch (handlerErr) {
          console.warn('Demo API handler error, falling back to original fetch:', handlerErr);
        }

        return rawFetch.call(this || window, input, init);
      };

      let patched = false;

      // Strategy 1: Object.defineProperty on window (defines own property to shadow prototype getter)
      try {
        Object.defineProperty(window, 'fetch', {
          value: interceptedFetch,
          writable: true,
          configurable: true,
          enumerable: true,
        });
        patched = true;
      } catch {
        // Continue to fallback strategies
      }

      // Strategy 2: Direct assignment
      if (!patched) {
        try {
          (window as any).fetch = interceptedFetch;
          patched = true;
        } catch {
          // Continue to fallback strategies
        }
      }

      // Strategy 3: Prototype definition
      if (!patched) {
        try {
          const proto = Object.getPrototypeOf(window);
          if (proto) {
            Object.defineProperty(proto, 'fetch', {
              value: interceptedFetch,
              writable: true,
              configurable: true,
            });
            patched = true;
          }
        } catch {
          // Continue
        }
      }

      // Strategy 4: globalThis definition
      if (!patched && typeof globalThis !== 'undefined') {
        try {
          Object.defineProperty(globalThis, 'fetch', {
            value: interceptedFetch,
            writable: true,
            configurable: true,
          });
          patched = true;
        } catch {
          // Ignore
        }
      }
    }
  } catch (err) {
    console.warn('Demo fetch interceptor could not patch fetch directly:', err);
  }

  // Crucial: Clear all demo data as soon as the user goes out of the app
  try {
    window.addEventListener('beforeunload', () => {
      if (isDemoSession()) {
        endDemoSession();
      }
    });

    window.addEventListener('pagehide', () => {
      if (isDemoSession()) {
        endDemoSession();
      }
    });
  } catch (listenerErr) {
    console.warn('Could not attach beforeunload/pagehide listener:', listenerErr);
  }

  isInterceptorInstalled = true;
}

