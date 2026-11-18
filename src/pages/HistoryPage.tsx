import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Flame,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DailyNutrition, DailyMoney, FoodEntry, Expense } from '../types.ts';
import { formatINR, formatDateReadable } from '../lib/utils.ts';
import { DailySummaryModal } from '../components/DailySummaryModal.tsx';

interface HistoryPageProps {
  onSelectDateToTrack: (date: string) => void;
}

export function HistoryPage({ onSelectDateToTrack }: HistoryPageProps) {
  const { getAuthHeaders } = useAuth();

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1); // 1-12
  const [nutritionMap, setNutritionMap] = useState<Record<string, DailyNutrition>>({});
  const [moneyMap, setMoneyMap] = useState<Record<string, DailyMoney>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<{
    nutrition: DailyNutrition | null;
    money: DailyMoney | null;
    foodEntries: FoodEntry[];
    expenses: Expense[];
  } | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // Fetch month overview
  const loadMonthData = useCallback(async () => {
    try {
      const [nutRes, monRes] = await Promise.all([
        fetch(`/api/history/nutrition?year=${currentYear}&month=${currentMonth}`, {
          headers: getAuthHeaders(),
        }),
        fetch(`/api/history/money?year=${currentYear}&month=${currentMonth}`, {
          headers: getAuthHeaders(),
        }),
      ]);

      if (nutRes.ok) {
        const nutData: DailyNutrition[] = await nutRes.json();
        const map: Record<string, DailyNutrition> = {};
        nutData.forEach((n) => {
          map[n.date] = n;
        });
        setNutritionMap(map);
      }

      if (monRes.ok) {
        const monData: DailyMoney[] = await monRes.json();
        const map: Record<string, DailyMoney> = {};
        monData.forEach((m) => {
          map[m.date] = m;
        });
        setMoneyMap(map);
      }
    } catch (err) {
      console.error('Failed to load history data:', err);
    }
  }, [currentYear, currentMonth, getAuthHeaders]);

  useEffect(() => {
    loadMonthData();
  }, [loadMonthData]);

  // Load single day inspection details
  const loadDayDetails = async (dateStr: string) => {
    setSelectedDay(dateStr);
    setIsDetailsLoading(true);
    try {
      const [dietRes, expRes] = await Promise.all([
        fetch(`/api/diet/day/${dateStr}`, { headers: getAuthHeaders() }),
        fetch(`/api/expenses/day/${dateStr}`, { headers: getAuthHeaders() }),
      ]);

      const dietData = dietRes.ok ? await dietRes.json() : { nutrition: null, entries: [] };
      const expData = expRes.ok ? await expRes.json() : { money: null, expenses: [] };

      setDayDetails({
        nutrition: dietData.nutrition,
        money: expData.money,
        foodEntries: dietData.entries || [],
        expenses: expData.expenses || [],
      });
    } catch (err) {
      console.error('Failed to load day details:', err);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Calendar calculations
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayWeekday = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 (Sun) to 6 (Sat)

  const dayCells = [];
  // Leading empty cells
  for (let i = 0; i < firstDayWeekday; i++) {
    dayCells.push(null);
  }
  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const formattedDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    dayCells.push({ dayNumber: d, dateStr: formattedDate });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header & Month Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            History & Calendar Archive
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Review past days, inspect nutrition entries, audit cash logs, and track consistency.
          </p>
        </div>

        {/* Month Navigator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 text-sm font-bold text-slate-900 dark:text-white select-none min-w-[140px] text-center">
              {monthNames[currentMonth - 1]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              const now = new Date();
              setCurrentYear(now.getFullYear());
              setCurrentMonth(now.getMonth() + 1);
            }}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            This Month
          </button>
        </div>
      </div>

      {/* Main Split Grid: Calendar Grid (8 cols) + Day Inspector (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar (8 Cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-slate-400 mb-2">
            <div>SUN</div>
            <div>MON</div>
            <div>TUE</div>
            <div>WED</div>
            <div>THU</div>
            <div>FRI</div>
            <div>SAT</div>
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {dayCells.map((cell, idx) => {
              if (!cell) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[85px] sm:min-h-[95px] rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-transparent opacity-30"
                  />
                );
              }

              const nut = nutritionMap[cell.dateStr];
              const mon = moneyMap[cell.dateStr];
              const hasNut = nut && Number(nut.totalCalories) > 0;
              const hasMon = mon && (Number(mon.startingBalance) > 0 || Number(mon.totalSpent) > 0);
              const isSelected = selectedDay === cell.dateStr;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => loadDayDetails(cell.dateStr)}
                  className={`min-h-[85px] sm:min-h-[95px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'ring-2 ring-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-500 shadow-xs'
                      : 'border-slate-200/70 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-extrabold ${
                        isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                  </div>

                  {/* Day activity badges */}
                  <div className="space-y-1">
                    {hasNut ? (
                      <div className="p-0.5 px-1 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 text-[10px] font-bold truncate flex items-center gap-1">
                        <Flame className="w-2.5 h-2.5 shrink-0" />
                        <span>{nut.totalCalories}k</span>
                      </div>
                    ) : null}

                    {hasMon ? (
                      <div className="p-0.5 px-1 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold truncate flex items-center gap-1">
                        <Wallet className="w-2.5 h-2.5 shrink-0" />
                        <span>{formatINR(Number(mon.totalSpent))}</span>
                      </div>
                    ) : null}

                    {!hasNut && !hasMon && (
                      <span className="block text-[9px] text-slate-300 dark:text-slate-600 text-center py-1">
                        -
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Calories Logged
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Expenses Recorded
              </span>
            </div>
            <span>Click any day to inspect details</span>
          </div>
        </div>

        {/* Day Inspection Drawer (4 Cols) */}
        <div className="lg:col-span-4">
          {selectedDay ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    Day Details
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {formatDateReadable(selectedDay)}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isDetailsLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading details...</div>
              ) : (
                <div className="space-y-4">
                  {/* Nutrition Snapshot */}
                  <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-amber-600" /> Diet & Nutrition
                      </span>
                      <span>{dayDetails?.foodEntries.length || 0} meals</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 text-[11px]">Calories:</span>
                        <p className="font-extrabold text-amber-700 dark:text-amber-400 text-sm">
                          {dayDetails?.nutrition?.totalCalories || 0} kcal
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px]">Protein:</span>
                        <p className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                          {dayDetails?.nutrition?.totalProtein || 0} g
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Financial Snapshot */}
                  <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Wallet className="w-4 h-4 text-indigo-600" /> Money & Cash
                      </span>
                      <span>{dayDetails?.expenses.length || 0} expenses</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 text-[11px]">Spent:</span>
                        <p className="font-extrabold text-rose-600 text-sm">
                          {formatINR(Number(dayDetails?.money?.totalSpent || 0))}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px]">Remaining:</span>
                        <p className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                          {formatINR(Number(dayDetails?.money?.remainingBalance || 0))}
                        </p>
                      </div>
                    </div>

                    {dayDetails?.money?.actualBalance !== null &&
                      dayDetails?.money?.actualBalance !== undefined && (
                        <div className="mt-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Actual Audit:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {formatINR(Number(dayDetails.money.actualBalance))}
                          </span>
                        </div>
                      )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 space-y-2">
                    <button
                      onClick={() => onSelectDateToTrack(selectedDay)}
                      className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span>Open in Tracker</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setIsSummaryOpen(true)}
                      className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Printable Summary</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-8 shadow-2xs text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Select a Date</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Click any calendar cell to view itemized foods, protein consumption, and financial breakdown for that date.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Daily Summary Modal */}
      {selectedDay && (
        <DailySummaryModal
          isOpen={isSummaryOpen}
          date={selectedDay}
          nutrition={dayDetails?.nutrition || null}
          money={dayDetails?.money || null}
          foodEntries={dayDetails?.foodEntries || []}
          expenses={dayDetails?.expenses || []}
          onClose={() => setIsSummaryOpen(false)}
        />
      )}
    </div>
  );
}
