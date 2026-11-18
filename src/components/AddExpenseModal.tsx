import React, { useState, useEffect } from 'react';
import { X, IndianRupee } from 'lucide-react';
import { Expense, ExpenseCategory } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

interface AddExpenseModalProps {
  isOpen: boolean;
  selectedDate: string;
  editExpense?: Expense | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES: { id: ExpenseCategory; label: string; icon: string }[] = [
  { id: 'Food', label: 'Food & Groceries', icon: '🍽' },
  { id: 'Travel', label: 'Travel & Transport', icon: '🚗' },
  { id: 'Shopping', label: 'Shopping', icon: '🛍' },
  { id: 'Education', label: 'Education & Books', icon: '📚' },
  { id: 'Entertainment', label: 'Entertainment & Outings', icon: '🎬' },
  { id: 'Bills', label: 'Bills & Utilities', icon: '⚡' },
  { id: 'Health', label: 'Health & Pharmacy', icon: '💊' },
  { id: 'Other', label: 'Other', icon: '📦' },
];

export function AddExpenseModal({
  isOpen,
  selectedDate,
  editExpense,
  onClose,
  onSuccess,
}: AddExpenseModalProps) {
  const { getAuthHeaders } = useAuth();
  const toast = useToast();

  const [date, setDate] = useState(selectedDate);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editExpense) {
      setDate(editExpense.date);
      setDescription(editExpense.description);
      setCategory(editExpense.category);
      setAmount(String(editExpense.amount));
      setNotes(editExpense.notes || '');
    } else {
      setDate(selectedDate);
      setDescription('');
      setCategory('Food');
      setAmount('');
      setNotes('');
    }
  }, [editExpense, isOpen, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Description is required.');
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      toast.error('Amount must be a non-negative number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        date,
        description: description.trim(),
        category,
        amount: numAmount,
        notes: notes.trim(),
      };

      const url = editExpense ? `/api/expenses/${editExpense.id}` : '/api/expenses';
      const method = editExpense ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save expense.');
        return;
      }

      toast.success(editExpense ? 'Expense updated!' : 'Expense recorded!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Failed to save expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {editExpense ? 'Edit Expense' : 'Add Expense'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Keep track of daily spending and budget
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Date & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Item
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Lunch with team, Bus pass, Grocery store..."
              required
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Amount (₹ INR) */}
          <div>
            <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1">
              Amount (₹ INR)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 dark:text-slate-500">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                required
                className="w-full pl-9 pr-4 py-2.5 text-base font-bold bg-indigo-50/50 dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900/60 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[50, 100, 200, 500, 1000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(String((Number(amount) || 0) + val))}
                  className="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors font-semibold"
                >
                  +₹{val}
                </button>
              ))}
              {amount && (
                <button
                  type="button"
                  onClick={() => setAmount('')}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid via UPI, bill attached"
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving...' : editExpense ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
