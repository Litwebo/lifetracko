import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  Dumbbell,
  Wallet,
  ArrowDownRight,
  TrendingDown,
  Plus,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Sparkles,
  FileText,
  Scale,
} from 'lucide-react';
import {
  DailyNutrition,
  DailyMoney,
  FoodEntry,
  Expense,
  MealType,
  BodyWeight,
} from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import {
  formatINR,
  getGreeting,
  formatDateReadable,
  getTodayDateString,
} from '../lib/utils.ts';
import { AddFoodModal } from '../components/AddFoodModal.tsx';
import { AddExpenseModal } from '../components/AddExpenseModal.tsx';
import { StartingBalanceModal } from '../components/StartingBalanceModal.tsx';
import { ActualBalanceModal } from '../components/ActualBalanceModal.tsx';
import { DailySummaryModal } from '../components/DailySummaryModal.tsx';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import { AdminAccessPrompt } from '../components/AdminAccessPrompt.tsx';

interface DashboardPageProps {
  onNavigateTab: (tab: string) => void;
}

export function DashboardPage({ onNavigateTab }: DashboardPageProps) {
  const { user, getAuthHeaders } = useAuth();
  const toast = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [money, setMoney] = useState<DailyMoney | null>(null);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [todayWeight, setTodayWeight] = useState<BodyWeight | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [editFoodEntry, setEditFoodEntry] = useState<FoodEntry | null>(null);
  const [defaultMealType, setDefaultMealType] = useState<MealType>('Breakfast');

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  const [isStartingBalanceModalOpen, setIsStartingBalanceModalOpen] = useState(false);
  const [isActualBalanceModalOpen, setIsActualBalanceModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Deletion confirms
  const [deleteItem, setDeleteItem] = useState<{
    type: 'food' | 'expense';
    id: number;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch all data for selected date
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dietRes, expRes, weightRes] = await Promise.all([
        fetch(`/api/diet/day/${selectedDate}`, { headers: getAuthHeaders() }),
        fetch(`/api/expenses/day/${selectedDate}`, { headers: getAuthHeaders() }),
        fetch(`/api/weight?date=${selectedDate}`, { headers: getAuthHeaders() }),
      ]);

      if (dietRes.ok) {
        const dietData = await dietRes.json();
        setNutrition(dietData.nutrition);
        setFoodEntries(dietData.entries || []);
      }

      if (expRes.ok) {
        const expData = await expRes.json();
        setMoney(expData.money);
        setExpenses(expData.expenses || []);
      }

      if (weightRes.ok) {
        const weightData = await weightRes.json();
        setTodayWeight(weightData.entry || null);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, getAuthHeaders]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Date Navigation
  const changeDateBy = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    const ny = dateObj.getFullYear();
    const nm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const nd = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${ny}-${nm}-${nd}`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    try {
      const endpoint =
        deleteItem.type === 'food'
          ? `/api/diet/${deleteItem.id}`
          : `/api/expenses/${deleteItem.id}`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        toast.success(`${deleteItem.name} removed successfully.`);
        loadDashboardData();
      } else {
        toast.error('Failed to delete item.');
      }
    } catch (err) {
      toast.error('Network error while deleting item.');
    } finally {
      setIsDeleting(false);
      setDeleteItem(null);
    }
  };

  // Calculations
  const totalCalories = nutrition ? Number(nutrition.totalCalories) : 0;
  const targetCalories = nutrition ? Number(nutrition.targetCalories) : user?.dailyCalories || 2200;
  const totalProtein = nutrition ? Number(nutrition.totalProtein) : 0;
  const targetProtein = nutrition ? Number(nutrition.targetProtein) : user?.dailyProtein || 120;

  const startingBalance = money ? Number(money.startingBalance) : 0;
  const totalSpent = money ? Number(money.totalSpent) : 0;
  const remainingBalance = money ? Number(money.remainingBalance) : 0;
  const actualBalance =
    money?.actualBalance !== null && money?.actualBalance !== undefined
      ? Number(money.actualBalance)
      : null;
  const difference =
    money?.difference !== null && money?.difference !== undefined
      ? Number(money.difference)
      : null;

  const caloriePct = Math.min(100, Math.round((totalCalories / (targetCalories || 1)) * 100));
  const proteinPct = Math.min(100, Math.round((totalProtein / (targetProtein || 1)) * 100));

  // Meal grouping
  const meals: { type: MealType; label: string; icon: string }[] = [
    { type: 'Breakfast', label: 'Breakfast', icon: '🍳' },
    { type: 'Lunch', label: 'Lunch', icon: '🍗' },
    { type: 'Dinner', label: 'Dinner', icon: '🍽' },
    { type: 'Snack', label: 'Snacks & Extras', icon: '🍎' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Admin Access Permission Prompt */}
      <AdminAccessPrompt />

      {/* Top Header & Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {getGreeting(user?.name || 'Friend')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Here is your comprehensive health & financial snapshot for today.
          </p>
        </div>

        {/* Date Selector Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => changeDateBy(-1)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center px-2 gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => changeDateBy(1)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {selectedDate !== getTodayDateString() && (
            <button
              onClick={() => setSelectedDate(getTodayDateString())}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              Today
            </button>
          )}

          <button
            onClick={() => setIsSummaryModalOpen(true)}
            className="p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            title="Generate Day Summary"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Daily Summary</span>
          </button>
        </div>
      </div>

      {/* 6 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Calories Consumed */}
        <div
          onClick={() => onNavigateTab('diet')}
          className="cursor-pointer bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-amber-400 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Calories Intake</span>
              <div className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{totalCalories}</span>
              <span className="text-xs text-slate-400 font-medium">/ {targetCalories} kcal</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  caloriePct > 105 ? 'bg-rose-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'
                }`}
                style={{ width: `${caloriePct}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
              <span>{caloriePct}%</span>
              <span>{targetCalories - totalCalories > 0 ? `${targetCalories - totalCalories} left` : 'Met'}</span>
            </div>
          </div>
        </div>

        {/* 2. Protein Consumed */}
        <div
          onClick={() => onNavigateTab('diet')}
          className="cursor-pointer bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-emerald-400 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Protein Intake</span>
              <div className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Dumbbell className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalProtein}</span>
              <span className="text-xs text-slate-400 font-medium">/ {targetProtein} g</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${proteinPct}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
              <span>{proteinPct}%</span>
              <span>{targetProtein - totalProtein > 0 ? `${(targetProtein - totalProtein).toFixed(0)}g left` : 'Done'}</span>
            </div>
          </div>
        </div>

        {/* 3. Body Weight */}
        <div
          onClick={() => onNavigateTab('diet')}
          className="cursor-pointer bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-teal-400 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Body Weight</span>
              <div className="p-1.5 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              {todayWeight ? (
                <>
                  <span className="text-2xl font-black text-teal-600 dark:text-teal-400">
                    {todayWeight.weight}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{todayWeight.unit}</span>
                </>
              ) : (
                <span className="text-base font-bold text-slate-400">
                  Not logged
                </span>
              )}
            </div>
          </div>
          <p className="mt-3 text-[11px] text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
            <Edit2 className="w-3 h-3" /> {todayWeight ? 'Recorded · View Log' : 'Click to record weight'}
          </p>
        </div>

        {/* 4. Starting Balance */}
        <div
          onClick={() => setIsStartingBalanceModalOpen(true)}
          className="cursor-pointer bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-indigo-400 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Starting Balance</span>
              <div className="p-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {formatINR(startingBalance)}
              </span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
            <Edit2 className="w-3 h-3" /> Adjust starting cash
          </p>
        </div>

        {/* 5. Total Spent */}
        <div
          onClick={() => onNavigateTab('expenses')}
          className="cursor-pointer bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-rose-400 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Total Spent</span>
              <div className="p-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {formatINR(totalSpent)}
              </span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            {expenses.length} {expenses.length === 1 ? 'item' : 'items'} logged
          </p>
        </div>

        {/* 6. Remaining Balance (Calculated) */}
        <div
          onClick={() => setIsActualBalanceModalOpen(true)}
          className={`cursor-pointer p-4 rounded-2xl border shadow-2xs transition-all flex flex-col justify-between ${
            remainingBalance < 0
              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-violet-400'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Remaining Amount</span>
              <div className="p-1.5 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span
                className={`text-2xl font-black ${
                  remainingBalance < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'
                }`}
              >
                {formatINR(remainingBalance)}
              </span>
            </div>
          </div>
          <div className="mt-2.5">
            {actualBalance !== null ? (
              difference === 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" /> Verified (₹{actualBalance})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
                  <AlertTriangle className="w-3 h-3" /> Diff: {formatINR(difference || 0)}
                </span>
              )
            ) : (
              <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold">
                Start ₹{startingBalance} - Spent ₹{totalSpent}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Strip */}
      <div className="flex flex-wrap items-center gap-2.5 p-3.5 bg-slate-100/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/70 dark:border-slate-800">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Quick Actions:
        </span>

        <button
          onClick={() => {
            setEditFoodEntry(null);
            setDefaultMealType('Breakfast');
            setIsFoodModalOpen(true);
          }}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Log Meal / Food
        </button>

        <button
          onClick={() => {
            setEditExpense(null);
            setIsExpenseModalOpen(true);
          }}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Record Expense
        </button>

        <button
          onClick={() => setIsStartingBalanceModalOpen(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
        >
          Set Starting Cash
        </button>

        <button
          onClick={() => setIsActualBalanceModalOpen(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
        >
          Verify End Balance
        </button>
      </div>

      {/* Main Content Split Grid: Meals on Left, Expenses on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Today's Diet & Meals (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Today's Meals & Nutrition</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold">
                  {foodEntries.length} items
                </span>
              </h2>
              <p className="text-xs text-slate-500">Calories and protein breakdown by meal</p>
            </div>
            <button
              onClick={() => {
                setEditFoodEntry(null);
                setDefaultMealType('Lunch');
                setIsFoodModalOpen(true);
              }}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Food
            </button>
          </div>

          {/* Meals Grouped */}
          {meals.map((m) => {
            const items = foodEntries.filter((f) => f.mealType === m.type);
            const mealCalories = items.reduce((acc, curr) => acc + Number(curr.calories), 0);
            const mealProtein = items.reduce((acc, curr) => acc + Number(curr.protein), 0);

            return (
              <div
                key={m.type}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{m.icon}</span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{m.label}</h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {mealCalories} kcal
                      </span>
                      <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {mealProtein.toFixed(1)}g protein
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setEditFoodEntry(null);
                        setDefaultMealType(m.type);
                        setIsFoodModalOpen(true);
                      }}
                      title={`Add item to ${m.label}`}
                      className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Items in this meal */}
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center italic">
                    No items recorded for {m.label.toLowerCase()}.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="py-2.5 flex items-center justify-between gap-2 group"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {item.foodName}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {item.quantity} {item.unit}
                            {item.notes ? ` · ${item.notes}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {item.calories} kcal
                            </span>
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold ml-2">
                              {item.protein}g P
                            </span>
                          </div>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditFoodEntry(item);
                                setIsFoodModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
                              title="Edit item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                setDeleteItem({
                                  type: 'food',
                                  id: item.id,
                                  name: item.foodName,
                                })
                              }
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                              title="Delete item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column: Today's Expenses (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Today's Expenses</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-semibold">
                  {formatINR(totalSpent)}
                </span>
              </h2>
              <p className="text-xs text-slate-500">Every rupee spent tracked</p>
            </div>
            <button
              onClick={() => {
                setEditExpense(null);
                setIsExpenseModalOpen(true);
              }}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Expense
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs">
            {expenses.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-500 mx-auto flex items-center justify-center mb-3">
                  <Wallet className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No expenses recorded today
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Log your tea, lunch, transport, or groceries to keep your ledger balanced.
                </p>
                <button
                  onClick={() => {
                    setEditExpense(null);
                    setIsExpenseModalOpen(true);
                  }}
                  className="mt-4 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add First Expense
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="py-3 flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {exp.description}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {exp.category}
                        </span>
                      </div>
                      {exp.notes && (
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{exp.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                        {formatINR(Number(exp.amount))}
                      </span>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditExpense(exp);
                            setIsExpenseModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
                          title="Edit expense"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteItem({
                              type: 'expense',
                              id: exp.id,
                              name: exp.description,
                            })
                          }
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                          title="Delete expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Ledger Balance Footer */}
                <div className="pt-4 mt-2 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Starting Cash:</span>
                    <span className="font-semibold">{formatINR(startingBalance)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Total Spent Today:</span>
                    <span className="font-semibold text-rose-600">-{formatINR(totalSpent)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>Expected Balance:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
                      {formatINR(remainingBalance)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddFoodModal
        isOpen={isFoodModalOpen}
        selectedDate={selectedDate}
        editEntry={editFoodEntry}
        defaultMeal={defaultMealType}
        onClose={() => setIsFoodModalOpen(false)}
        onSuccess={loadDashboardData}
      />

      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        selectedDate={selectedDate}
        editExpense={editExpense}
        onClose={() => setIsExpenseModalOpen(false)}
        onSuccess={loadDashboardData}
      />

      <StartingBalanceModal
        isOpen={isStartingBalanceModalOpen}
        selectedDate={selectedDate}
        currentBalance={startingBalance}
        onClose={() => setIsStartingBalanceModalOpen(false)}
        onSuccess={loadDashboardData}
      />

      <ActualBalanceModal
        isOpen={isActualBalanceModalOpen}
        selectedDate={selectedDate}
        expectedBalance={remainingBalance}
        currentActual={actualBalance}
        onClose={() => setIsActualBalanceModalOpen(false)}
        onSuccess={loadDashboardData}
      />

      <DailySummaryModal
        isOpen={isSummaryModalOpen}
        date={selectedDate}
        nutrition={nutrition}
        money={money}
        foodEntries={foodEntries}
        expenses={expenses}
        onClose={() => setIsSummaryModalOpen(false)}
      />

      <ConfirmModal
        isOpen={deleteItem !== null}
        title={`Delete ${deleteItem?.type === 'food' ? 'Food Entry' : 'Expense'}`}
        message={`Are you sure you want to permanently delete "${deleteItem?.name}"? This will automatically recalculate your daily totals.`}
        confirmLabel="Delete Item"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  );
}
