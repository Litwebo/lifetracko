import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Scale } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { formatINR } from '../lib/utils.ts';

interface ActualBalanceModalProps {
  isOpen: boolean;
  selectedDate: string;
  expectedBalance: number;
  currentActual: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ActualBalanceModal({
  isOpen,
  selectedDate,
  expectedBalance,
  currentActual,
  onClose,
  onSuccess,
}: ActualBalanceModalProps) {
  const { getAuthHeaders } = useAuth();
  const toast = useToast();
  const [actual, setActual] = useState<string>(
    currentActual !== null && currentActual !== undefined ? String(currentActual) : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setActual(currentActual !== null && currentActual !== undefined ? String(currentActual) : '');
  }, [currentActual, isOpen]);

  const numActual = actual !== '' ? Number(actual) : null;
  const difference = numActual !== null ? numActual - expectedBalance : null;
  const isMatch = difference === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actual === '') {
      toast.error('Please enter your actual balance.');
      return;
    }
    const num = Number(actual);
    if (isNaN(num) || num < 0) {
      toast.error('Actual balance must be a valid positive number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/expenses/balance/actual', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          date: selectedDate,
          actualBalance: num,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to record actual balance.');
        return;
      }

      if (isMatch) {
        toast.success('Balance verified! Your calculations match perfectly.');
      } else {
        toast.info('Actual balance recorded.');
      }

      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Network error recording balance.');
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
            <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
              <Scale className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Verify Day-End Balance</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs flex justify-between items-center">
          <span className="text-slate-600 dark:text-slate-400">Calculated Expected Balance:</span>
          <span className="font-bold text-slate-900 dark:text-white text-sm">
            {formatINR(expectedBalance)}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Actual Cash / Account Balance (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                placeholder="Enter what you actually have left"
                required
                className="w-full pl-9 pr-4 py-3 text-lg font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
              />
            </div>
          </div>

          {/* Real-time comparison feedback */}
          {difference !== null && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                isMatch
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
              }`}
            >
              {isMatch ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Balance verified ✓</p>
                    <p className="mt-0.5 text-[11px]">Your physical/account balance matches the tracked log perfectly!</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Discrepancy: {difference > 0 ? `+${formatINR(difference)} extra` : `${formatINR(Math.abs(difference))} shortage`}</p>
                    <p className="mt-0.5 text-[11px]">
                      Your actual balance differs from the calculated balance by {formatINR(Math.abs(difference))}. Check if any expense was missed or miscalculated.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

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
              className="px-5 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-sm shadow-violet-600/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Verifying...' : 'Save Verification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
