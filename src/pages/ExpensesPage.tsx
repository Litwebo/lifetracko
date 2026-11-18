import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ArrowDownRight,
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Search,
  Filter,
  Database,
} from 'lucide-react';
import { Expense, DailyMoney, ExpenseCategory } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { formatINR, getTodayDateString, formatDateReadable } from '../lib/utils.ts';
import { AddExpenseModal } from '../components/AddExpenseModal.tsx';
import { StartingBalanceModal } from '../components/StartingBalanceModal.tsx';
import { ActualBalanceModal } from '../components/ActualBalanceModal.tsx';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import { AdminAccessPrompt } from '../components/AdminAccessPrompt.tsx';

const CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Travel',
  'Shopping',
  'Education',
  'Entertainment',
  'Bills',
  'Health',
  'Other',
];

export function ExpensesPage() {
  const { getAuthHeaders } = useAuth();
  const toast = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [money, setMoney] = useState<DailyMoney | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(true);

  // Quick Add Expense Inline Form State
  const [quickDescription, setQuickDescription] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategory, setQuickCategory] = useState<ExpenseCategory>('Food');
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [isStartingBalanceOpen, setIsStartingBalanceOpen] = useState(false);
  const [isActualBalanceOpen, setIsActualBalanceOpen] = useState(false);
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadExpenseData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/expenses/day/${selectedDate}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMoney(data.money);
        setExpenses(data.expenses || []);
      }
    } catch (err) {
      console.error('Failed to load expense data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, getAuthHeaders]);

  useEffect(() => {
    loadExpenseData();
  }, [loadExpenseData]);

  const handleQuickAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDescription.trim()) {
      toast.error('Please enter expense description.');
      return;
    }
    const num = Number(quickAmount);
    if (isNaN(num) || num <= 0) {
      toast.error('Please enter a valid expense amount.');
      return;
    }

    setIsQuickSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          date: selectedDate,
          description: quickDescription.trim(),
          category: quickCategory,
          amount: num,
          notes: '',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to record expense.');
        return;
      }

      toast.success(`Logged ${formatINR(num)} for ${quickDescription}!`);
      setQuickDescription('');
      setQuickAmount('');
      loadExpenseData();
    } catch (err) {
      toast.error('Network error recording expense.');
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  const handleQuickSetStartingBalance = async (presetAmt: number) => {
    try {
      const res = await fetch('/api/expenses/balance/starting', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          date: selectedDate,
          startingBalance: presetAmt,
        }),
      });
      if (res.ok) {
        toast.success(`Starting balance set to ${formatINR(presetAmt)}!`);
        loadExpenseData();
      } else {
        toast.error('Failed to set starting balance.');
      }
    } catch (err) {
      toast.error('Network error updating balance.');
    }
  };

  const changeDateBy = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    const ny = dateObj.getFullYear();
    const nm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const nd = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${ny}-${nm}-${nd}`);
  };

  const handleDeleteExpense = async () => {
    if (!deleteExpense) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${deleteExpense.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        toast.success(`Removed expense: ${deleteExpense.description}`);
        loadExpenseData();
      } else {
        toast.error('Failed to delete expense.');
      }
    } catch (err) {
      toast.error('Network error deleting expense.');
    } finally {
      setIsDeleting(false);
      setDeleteExpense(null);
    }
  };

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

  // Filter expenses
  const filteredExpenses = expenses.filter((e) => {
    const matchesCat = selectedCategory === 'All' || e.category === selectedCategory;
    const matchesSearch =
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.notes && e.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Calculate category totals
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Admin Access Permission Prompt */}
      <AdminAccessPrompt />

      {/* Header & Date */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Money & Expense Tracker
            </h1>
            <span className="p-1 px-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400 text-xs font-bold">
              {formatDateReadable(selectedDate)}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200/80 dark:border-indigo-800/60"
              title="All spending records and cash ledger entries are saved permanently in the dedicated database and linked to your Gmail login."
            >
              <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Permanent DB Vault Active</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Record every expenditure and audit cash — all transactions are permanently preserved under your Gmail account with zero data loss.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => changeDateBy(-1)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 px-2 cursor-pointer focus:outline-none"
            />
            <button
              onClick={() => changeDateBy(1)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              setEditExpense(null);
              setIsExpenseModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* 3 Ledger Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Starting Cash */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Starting Balance</span>
              <button
                onClick={() => setIsStartingBalanceOpen(true)}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
              >
                <Edit2 className="w-3.5 h-3.5" /> Adjust
              </button>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
              {formatINR(startingBalance)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Initial funds on hand for the day</p>
          </div>

          {/* Quick preset chips */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold text-slate-400">Quick set:</span>
            {[500, 1000, 2000, 5000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleQuickSetStartingBalance(amt)}
                className="px-2 py-0.5 text-[11px] font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
              >
                ₹{amt}
              </button>
            ))}
          </div>
        </div>

        {/* Total Spent */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Spent</span>
              <span className="text-xs font-bold text-rose-600">
                {expenses.length} transactions
              </span>
            </div>
            <p className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-2">
              {formatINR(totalSpent)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Sum of all expenses recorded</p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>Database Synced</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {categoryTotals['Food'] ? `Food: ${formatINR(categoryTotals['Food'])}` : 'Live Tracking'}
            </span>
          </div>
        </div>

        {/* Expected Remaining */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Expected Remaining</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  remainingBalance < 0
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400'
                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {remainingBalance >= 0 ? 'Surplus' : 'Deficit'}
              </span>
            </div>
            <p
              className={`text-3xl font-black mt-2 ${
                remainingBalance < 0 ? 'text-rose-600' : 'text-indigo-600 dark:text-indigo-400'
              }`}
            >
              {formatINR(remainingBalance)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Starting balance minus total spent</p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>Formula</span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {formatINR(startingBalance)} − {formatINR(totalSpent)}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Add Expense Inline Form Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
              +
            </div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Quick Expense Entry
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Add spending in seconds</span>
        </div>

        <form onSubmit={handleQuickAddExpense} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-5">
            <input
              type="text"
              value={quickDescription}
              onChange={(e) => setQuickDescription(e.target.value)}
              placeholder="What did you spend on? (e.g., Chai & Snacks, Auto, Coffee)"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              required
            />
          </div>

          <div className="sm:col-span-3 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              ₹
            </span>
            <input
              type="number"
              min="0.01"
              step="any"
              value={quickAmount}
              onChange={(e) => setQuickAmount(e.target.value)}
              placeholder="Amount"
              className="w-full pl-7 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <select
              value={quickCategory}
              onChange={(e) => setQuickCategory(e.target.value as ExpenseCategory)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-medium"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isQuickSubmitting}
              className="w-full py-2 px-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isQuickSubmitting ? 'Adding...' : 'Add Expense'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Dynamic Money & Remaining Balance Equation Breakdown */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Remaining Balance Formula:</span>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              Starting {formatINR(startingBalance)}
            </span>
            <span className="text-slate-400 font-black">−</span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              Spent {formatINR(totalSpent)}
            </span>
            <span className="text-slate-400 font-black">=</span>
            <span className={`px-2.5 py-1 rounded-lg font-black border ${
              remainingBalance >= 0
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
            }`}>
              Remaining {formatINR(remainingBalance)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsStartingBalanceOpen(true)}
          className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
        >
          Change Starting Balance
        </button>
      </div>

      {/* Actual Balance Audit Banner */}
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 p-5 rounded-2xl border border-violet-200 dark:border-violet-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              End-of-Day Physical Balance Audit
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {actualBalance !== null ? (
                difference === 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Balance verified! Your actual cash ({formatINR(actualBalance)}) matches calculated balance.
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Discrepancy of {formatINR(Math.abs(difference || 0))} detected between physical and tracked balance.
                  </span>
                )
              ) : (
                'Count your physical cash or bank account balance at night to verify no cash was lost or unrecorded.'
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsActualBalanceOpen(true)}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-xs transition-colors shrink-0"
        >
          {actualBalance !== null ? 'Re-verify Balance' : 'Verify Ending Balance'}
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search description or notes..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 no-scrollbar text-xs">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === 'All'
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses Table / Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-500 mx-auto flex items-center justify-center mb-3">
              <Wallet className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No expenses match your criteria
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Add your daily bills, transport, meals, or groceries to manage your finances accurately.
            </p>
            <button
              onClick={() => {
                setEditExpense(null);
                setIsExpenseModalOpen(true);
              }}
              className="mt-4 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Expense
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredExpenses.map((exp) => (
              <div
                key={exp.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                    ₹
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {exp.description}
                      </p>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {exp.category}
                      </span>
                    </div>
                    {exp.notes && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{exp.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-base font-black text-rose-600 dark:text-rose-400">
                    {formatINR(Number(exp.amount))}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditExpense(exp);
                        setIsExpenseModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteExpense(exp)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        selectedDate={selectedDate}
        editExpense={editExpense}
        onClose={() => setIsExpenseModalOpen(false)}
        onSuccess={loadExpenseData}
      />

      <StartingBalanceModal
        isOpen={isStartingBalanceOpen}
        selectedDate={selectedDate}
        currentBalance={startingBalance}
        onClose={() => setIsStartingBalanceOpen(false)}
        onSuccess={loadExpenseData}
      />

      <ActualBalanceModal
        isOpen={isActualBalanceOpen}
        selectedDate={selectedDate}
        expectedBalance={remainingBalance}
        currentActual={actualBalance}
        onClose={() => setIsActualBalanceOpen(false)}
        onSuccess={loadExpenseData}
      />

      <ConfirmModal
        isOpen={deleteExpense !== null}
        title="Delete Expense Record"
        message={`Delete "${deleteExpense?.description}" of ${formatINR(Number(deleteExpense?.amount || 0))}? Your daily financial totals will recalculate immediately.`}
        confirmLabel="Delete Expense"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteExpense}
        onCancel={() => setDeleteExpense(null)}
      />
    </div>
  );
}
