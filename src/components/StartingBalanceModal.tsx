import React, { useState, useEffect } from 'react';
import { X, Wallet, IndianRupee } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { formatINR } from '../lib/utils.ts';

interface StartingBalanceModalProps {
  isOpen: boolean;
  selectedDate: string;
  currentBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function StartingBalanceModal({
  isOpen,
  selectedDate,
  currentBalance,
  onClose,
  onSuccess,
}: StartingBalanceModalProps) {
  const { getAuthHeaders } = useAuth();
  const toast = useToast();
  const [balance, setBalance] = useState<string>(String(currentBalance || 0));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setBalance(String(currentBalance || 0));
  }, [currentBalance, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(balance);
    if (isNaN(num) || num < 0) {
      toast.error('Starting balance must be a non-negative number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/expenses/balance/starting', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          date: selectedDate,
          startingBalance: num,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update starting balance.');
        return;
      }

      toast.success(`Starting balance set to ${formatINR(num)}!`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Network error updating balance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Wallet className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Starting Balance</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Set how much money you have on hand or in your account at the start of {selectedDate}.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
              ₹
            </span>
            <input
              type="number"
              min="0"
              step="any"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0"
              required
              className="w-full pl-9 pr-4 py-3 text-lg font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
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
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Balance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
