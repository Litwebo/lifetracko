import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Flame,
  Dumbbell,
  Wallet,
  Calendar,
  PieChart as PieIcon,
  Sparkles,
  Scale,
  Award,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { formatINR, formatShortDate } from '../lib/utils.ts';

const RANGE_OPTIONS = [
  { id: '7d', label: '7 Days', days: 7 },
  { id: '30d', label: '30 Days', days: 30 },
  { id: '90d', label: '3 Months', days: 90 },
  { id: '180d', label: '6 Months', days: 180 },
  { id: '365d', label: '1 Year', days: 365 },
];

const PIE_COLORS = [
  '#10b981', // emerald
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#64748b', // slate
];

type AnalyticsTab = 'overview' | 'nutrition' | 'finance' | 'weight';

export function AnalyticsPage() {
  const { user, getAuthHeaders } = useAuth();
  const [selectedRange, setSelectedRange] = useState('30d');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    const rangeObj = RANGE_OPTIONS.find((r) => r.id === selectedRange) || RANGE_OPTIONS[1];
    try {
      const res = await fetch(`/api/analytics/overview?days=${rangeObj.days}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRange, getAuthHeaders]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const targetCalories = user?.dailyCalories || analytics?.targetCalories || 2200;
  const targetProtein = user?.dailyProtein || analytics?.targetProtein || 120;

  // Process data for charts
  const dailyTrend = (analytics?.dailyTrend || []).map((item: any) => ({
    ...item,
    formattedDate: formatShortDate(item.date),
    calories: Number(item.calories || 0),
    protein: Number(item.protein || 0),
    spending: Number(item.spending || item.spent || 0),
  }));

  const categoryData = (analytics?.categorySpending || analytics?.categoryBreakdown || []).map((c: any) => ({
    name: c.category,
    value: Number(c.amount || c.total || 0),
    percentage: c.percentage || 0,
  }));

  const weightTrend = (analytics?.weightTrend || []).map((w: any) => ({
    ...w,
    formattedDate: formatShortDate(w.date),
    weight: Number(w.weight),
  }));

  const totalSpentRange = categoryData.reduce((acc: number, curr: any) => acc + curr.value, 0);
  const avgCal = analytics?.avgCalories || analytics?.stats?.avgCalories || 0;
  const avgProt = analytics?.avgProtein || analytics?.stats?.avgProtein || 0;
  const avgDailyExp = analytics?.avgDailySpending || analytics?.stats?.avgDailyExpense || 0;
  const consistencyScore = analytics?.consistencyScore || analytics?.stats?.consistencyScore || 0;
  const loggedDaysCount = analytics?.loggedDaysCount || analytics?.stats?.loggedDays || 0;

  // Weight delta
  const startWeight = weightTrend.length > 0 ? weightTrend[0].weight : null;
  const currentWeight = weightTrend.length > 0 ? weightTrend[weightTrend.length - 1].weight : null;
  const weightChange = startWeight !== null && currentWeight !== null ? Number((currentWeight - startWeight).toFixed(1)) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Creative Header & Filters */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border border-emerald-500/20">
                <Sparkles className="w-3.5 h-3.5" />
                Live Performance Hub
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                {loggedDaysCount} Days Tracked
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Analytics & Intelligence
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Deep statistical breakdown of your daily nutrition, expenditure, and body weight consistency.
            </p>
          </div>

          {/* Time Horizon Selection */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedRange(opt.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedRange === opt.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm scale-[1.02]'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* View Sub-Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto">
          {[
            { id: 'overview', label: 'All Insights', icon: Activity },
            { id: 'nutrition', label: 'Diet & Protein', icon: Flame },
            { id: 'finance', label: 'Money & Spending', icon: Wallet },
            { id: 'weight', label: 'Body Weight', icon: Scale },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AnalyticsTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-md scale-[1.02]'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Creative Bento Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Calorie Intake Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500" /> Avg Daily Calories
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Target {targetCalories}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {avgCal}{' '}
              <span className="text-xs font-semibold text-slate-400">kcal</span>
            </p>
            <span className={`text-xs font-bold flex items-center ${avgCal >= targetCalories ? 'text-emerald-500' : 'text-amber-500'}`}>
              {Math.round((avgCal / targetCalories) * 100)}% of goal
            </span>
          </div>
          <div className="mt-3 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (avgCal / targetCalories) * 100)}%` }}
            />
          </div>
        </div>

        {/* Protein Intake Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Dumbbell className="w-4 h-4 text-emerald-500" /> Avg Daily Protein
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Target {targetProtein}g
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {avgProt}{' '}
              <span className="text-xs font-semibold text-slate-400">g</span>
            </p>
            <span className={`text-xs font-bold flex items-center ${avgProt >= targetProtein ? 'text-emerald-500' : 'text-slate-400'}`}>
              {Math.round((avgProt / targetProtein) * 100)}% met
            </span>
          </div>
          <div className="mt-3 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (avgProt / targetProtein) * 100)}%` }}
            />
          </div>
        </div>

        {/* Financial Expense Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-indigo-500" /> Total Expense
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              {RANGE_OPTIONS.find((r) => r.id === selectedRange)?.label}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatINR(totalSpentRange)}
            </p>
            <span className="text-xs font-bold text-indigo-500">
              {formatINR(avgDailyExp)} / day
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Average expense calculated across range
          </p>
        </div>

        {/* Consistency Index Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-purple-500" /> Adherence Score
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Consistency Index
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
              {consistencyScore}%
            </p>
            <span className="text-xs font-bold text-emerald-500 flex items-center gap-0.5">
              <Zap className="w-3.5 h-3.5" /> High Streak
            </span>
          </div>
          <div className="mt-3 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${consistencyScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Charts Grid depending on Active Tab */}
      {(activeTab === 'overview' || activeTab === 'nutrition') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calorie Area Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" /> Daily Calorie Horizon
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calorie consumption vs target ({targetCalories} kcal line)
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              {dailyTrend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                  No diet logs available for this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="calorieGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="formattedDate" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(val: any) => [`${val} kcal`, 'Calories']}
                      labelFormatter={(lbl) => `Date: ${lbl}`}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none' }}
                    />
                    <ReferenceLine
                      y={targetCalories}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{ value: 'Target Goal', fill: '#f59e0b', fontSize: 10, position: 'top' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="calories"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#calorieGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Protein Bar Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-emerald-500" /> Daily Protein Intake
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Daily protein target ({targetProtein} g line)
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              {dailyTrend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                  No protein entries logged in this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="formattedDate" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(val: any) => [`${val} g`, 'Protein']}
                      labelFormatter={(lbl) => `Date: ${lbl}`}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none' }}
                    />
                    <ReferenceLine
                      y={targetProtein}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{ value: 'Protein Goal', fill: '#10b981', fontSize: 10, position: 'top' }}
                    />
                    <Bar dataKey="protein" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Financial Charts */}
      {(activeTab === 'overview' || activeTab === 'finance') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Daily Spending Bar Chart */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-indigo-500" /> Spending Timeline
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Daily expense flow (₹ INR)</p>
              </div>
            </div>

            <div className="h-72 w-full">
              {dailyTrend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                  No expenses logged in this timeframe.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="formattedDate" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(val) => `₹${val}`} />
                    <Tooltip
                      formatter={(val: any) => [formatINR(Number(val)), 'Spent']}
                      labelFormatter={(lbl) => `Date: ${lbl}`}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none' }}
                    />
                    <Bar dataKey="spending" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Category Donut & Breakdown */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-purple-500" /> Expense Allocation
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Category percentage split</p>
            </div>

            <div className="h-56 w-full my-2">
              {categoryData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                  No categorized expenses found.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatINR(Number(val)), 'Total Spent']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Category breakdown table */}
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 max-h-36 overflow-y-auto text-xs">
              {categoryData.map((cat: any, idx: number) => {
                const pct = totalSpentRange > 0 ? Math.round((cat.value / totalSpentRange) * 100) : 0;
                return (
                  <div key={cat.name} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {cat.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatINR(cat.value)}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Body Weight Trend Section */}
      {(activeTab === 'overview' || activeTab === 'weight') && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-teal-500" /> Body Weight Journey
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Weight change progression across selected timeframe</p>
            </div>

            {startWeight !== null && currentWeight !== null && (
              <div className="flex items-center gap-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-500/20 px-3.5 py-2 rounded-2xl">
                <div>
                  <p className="text-[10px] font-bold uppercase text-teal-600 dark:text-teal-400 tracking-wider">Net Change</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {weightChange > 0 ? `+${weightChange}` : weightChange} kg
                  </p>
                </div>
                {weightChange <= 0 ? (
                  <ArrowDownRight className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-amber-500 shrink-0" />
                )}
              </div>
            )}
          </div>

          <div className="h-64 w-full">
            {weightTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                No body weight entries logged in this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                  <XAxis dataKey="formattedDate" tick={{ fontSize: 10 }} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: any) => [`${val} kg`, 'Weight']}
                    labelFormatter={(lbl) => `Date: ${lbl}`}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#14b8a6"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#14b8a6' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* AI Smart Summary & Performance Tips */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-black tracking-tight text-white">
                Life Tracko Performance Intelligence
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Based on your overall logging patterns over the last <strong>{selectedRange}</strong>:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-200 pt-2">
              <li className="flex items-center gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Protein Consistency: <strong>{avgProt >= targetProtein ? 'On Goal ✓' : 'Add 15g to reach target'}</strong></span>
              </li>
              <li className="flex items-center gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <Wallet className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Daily Average Expense: <strong>{formatINR(avgDailyExp)}</strong></span>
              </li>
            </ul>
          </div>

          <div className="shrink-0 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 text-center min-w-[180px]">
            <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Health Status</p>
            <p className="text-2xl font-black text-emerald-400 mt-0.5">
              {consistencyScore >= 70 ? 'Excellent' : consistencyScore >= 40 ? 'Steady' : 'Building'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">{consistencyScore}% Consistency Index</p>
          </div>
        </div>
      </div>
    </div>
  );
}

