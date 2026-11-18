import { X, Printer, Flame, Dumbbell, Wallet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DailyNutrition, DailyMoney, FoodEntry, Expense } from '../types.ts';
import { formatINR, formatDateReadable } from '../lib/utils.ts';

interface DailySummaryModalProps {
  isOpen: boolean;
  date: string;
  nutrition: DailyNutrition | null;
  money: DailyMoney | null;
  foodEntries: FoodEntry[];
  expenses: Expense[];
  onClose: () => void;
}

export function DailySummaryModal({
  isOpen,
  date,
  nutrition,
  money,
  foodEntries,
  expenses,
  onClose,
}: DailySummaryModalProps) {
  if (!isOpen) return null;

  const totalCalories = nutrition ? Number(nutrition.totalCalories) : 0;
  const targetCalories = nutrition ? Number(nutrition.targetCalories) : 2200;
  const totalProtein = nutrition ? Number(nutrition.totalProtein) : 0;
  const targetProtein = nutrition ? Number(nutrition.targetProtein) : 120;

  const startingBalance = money ? Number(money.startingBalance) : 0;
  const totalSpent = money ? Number(money.totalSpent) : 0;
  const remainingBalance = money ? Number(money.remainingBalance) : 0;
  const actualBalance = money?.actualBalance !== null && money?.actualBalance !== undefined ? Number(money.actualBalance) : null;
  const difference = money?.difference !== null && money?.difference !== undefined ? Number(money.difference) : null;

  const calPct = Math.min(100, Math.round((totalCalories / (targetCalories || 1)) * 100));
  const proPct = Math.min(100, Math.round((totalProtein / (targetProtein || 1)) * 100));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg text-emerald-600">Life Tracko</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                Daily Performance Report
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {formatDateReadable(date)}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-1.5 text-xs font-semibold"
              title="Print Summary"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="mt-6 space-y-6">
          {/* Nutrition Section */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Diet & Nutrition</h3>
              </div>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {foodEntries.length} items logged
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                <p className="text-xs text-slate-500 mb-1">Calories Consumed</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{totalCalories}</span>
                  <span className="text-xs text-slate-400">/ {targetCalories} kcal ({calPct}%)</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all"
                    style={{ width: `${calPct}%` }}
                  />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                <p className="text-xs text-slate-500 mb-1">Protein Consumed</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalProtein}g</span>
                  <span className="text-xs text-slate-400">/ {targetProtein}g ({proPct}%)</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all"
                    style={{ width: `${proPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick meal list */}
            {foodEntries.length > 0 && (
              <div className="mt-4 pt-4 border-t border-emerald-200/50 dark:border-emerald-800/40">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Logged Foods:</p>
                <div className="flex flex-wrap gap-1.5">
                  {foodEntries.map((f) => (
                    <span
                      key={f.id}
                      className="px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 shadow-2xs"
                    >
                      {f.foodName} ({f.calories}kcal, {f.protein}g)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Money & Expenses Section */}
          <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Money & Expenses</h3>
              </div>
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                {expenses.length} expenses
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <p className="text-xs text-slate-500">Starting Balance</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatINR(startingBalance)}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <p className="text-xs text-slate-500">Total Spent</p>
                <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                  {formatINR(totalSpent)}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <p className="text-xs text-slate-500">Expected Remaining</p>
                <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {formatINR(remainingBalance)}
                </p>
              </div>
            </div>

            {/* Actual balance verification card */}
            {actualBalance !== null ? (
              <div className="mt-3.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500">Actual Ending Balance: </span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {formatINR(actualBalance)}
                  </span>
                </div>
                {difference === 0 ? (
                  <span className="flex items-center gap-1 font-bold text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" /> Verified Match
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-bold text-amber-600">
                    <AlertTriangle className="w-4 h-4" /> Discrepancy: {formatINR(difference || 0)}
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500 italic">
                * Actual end-of-day balance has not been verified yet.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 rounded-xl"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
