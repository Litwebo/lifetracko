import React, { useState, useEffect, useCallback } from 'react';
import { Scale, TrendingDown, TrendingUp, Minus, Calendar, Plus, Trash2, Check, Save } from 'lucide-react';
import { BodyWeight } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { formatShortDate } from '../lib/utils.ts';

interface BodyWeightSectionProps {
  selectedDate: string;
  onWeightUpdated?: () => void;
}

export function BodyWeightSection({ selectedDate, onWeightUpdated }: BodyWeightSectionProps) {
  const { getAuthHeaders } = useAuth();
  const toast = useToast();

  const [currentEntry, setCurrentEntry] = useState<BodyWeight | null>(null);
  const [weightInput, setWeightInput] = useState<string>('');
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [notes, setNotes] = useState<string>('');
  const [history, setHistory] = useState<BodyWeight[]>([]);
  const [stats, setStats] = useState<{
    currentWeight: number | null;
    startWeight: number | null;
    change: number;
    minWeight: number | null;
    maxWeight: number | null;
    loggedDays: number;
  }>({
    currentWeight: null,
    startWeight: null,
    change: 0,
    minWeight: null,
    maxWeight: null,
    loggedDays: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load weight data for selected date and history
  const loadWeightData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dayRes, historyRes] = await Promise.all([
        fetch(`/api/weight?date=${selectedDate}`, { headers: getAuthHeaders() }),
        fetch(`/api/weight/history?days=30`, { headers: getAuthHeaders() }),
      ]);

      if (dayRes.ok) {
        const dayData = await dayRes.json();
        if (dayData.entry) {
          setCurrentEntry(dayData.entry);
          setWeightInput(String(dayData.entry.weight));
          setUnit(dayData.entry.unit || 'kg');
          setNotes(dayData.entry.notes || '');
        } else {
          setCurrentEntry(null);
          // If no weight for today, prefill with latest weight if available or empty
          if (dayData.latest) {
            setWeightInput(String(dayData.latest.weight));
            setUnit(dayData.latest.unit || 'kg');
          } else {
            setWeightInput('');
          }
          setNotes('');
        }
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData.history || []);
        if (historyData.stats) {
          setStats(historyData.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load body weight data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, getAuthHeaders]);

  useEffect(() => {
    loadWeightData();
  }, [loadWeightData]);

  const handleSaveWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(weightInput);
    if (isNaN(num) || num <= 10 || num >= 500) {
      toast.error('Please enter a valid body weight between 10 and 500.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/weight', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          date: selectedDate,
          weight: num,
          unit,
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save weight.');
        return;
      }

      toast.success(currentEntry ? 'Body weight updated!' : 'Body weight recorded!');
      setCurrentEntry(data.entry);
      loadWeightData();
      if (onWeightUpdated) onWeightUpdated();
    } catch (err) {
      toast.error('Network error saving weight.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWeight = async (id: number) => {
    try {
      const res = await fetch(`/api/weight/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        toast.success('Weight entry deleted.');
        if (currentEntry && currentEntry.id === id) {
          setCurrentEntry(null);
          setWeightInput('');
          setNotes('');
        }
        loadWeightData();
        if (onWeightUpdated) onWeightUpdated();
      } else {
        toast.error('Failed to delete weight entry.');
      }
    } catch (err) {
      toast.error('Network error deleting weight.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Body Weight Section
            </h2>
            <p className="text-xs text-slate-500">
              Track daily body mass for {selectedDate} and monitor progress over time
            </p>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 text-xs">
          {stats.currentWeight !== null && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Current</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">
                {stats.currentWeight} {unit}
              </span>
            </div>
          )}

          {stats.loggedDays > 1 && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Net Change</span>
              <span
                className={`font-extrabold flex items-center gap-0.5 ${
                  stats.change < 0
                    ? 'text-teal-600 dark:text-teal-400'
                    : stats.change > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {stats.change < 0 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : stats.change > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                {stats.change > 0 ? `+${stats.change}` : stats.change} {unit}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Weight Input Form for Selected Date */}
        <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {currentEntry ? 'Update Weight for Date' : 'Log Weight for Date'}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              {selectedDate}
            </span>
          </div>

          <form onSubmit={handleSaveWeight} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Body Weight Value
              </label>
              <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-teal-500">
                <input
                  type="number"
                  step="0.1"
                  min="10"
                  max="500"
                  required
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder="e.g. 74.5"
                  className="w-full bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                />
                <div className="flex bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 p-0.5">
                  <button
                    type="button"
                    onClick={() => setUnit('kg')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                      unit === 'kg'
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnit('lbs')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                      unit === 'lbs'
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    lbs
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Morning weigh-in, empty stomach"
                className="w-full bg-white dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={isSaving || !weightInput}
                className="flex-1 py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                {isSaving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    {currentEntry ? 'Update Weight' : 'Record Weight'}
                  </>
                )}
              </button>

              {currentEntry && (
                <button
                  type="button"
                  onClick={() => handleDeleteWeight(currentEntry.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 transition-colors"
                  title="Remove weight record for this date"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right: Recent Weight Logs Table */}
        <div className="lg:col-span-7">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Recent Weigh-in History
            </span>
            <span className="text-[11px] text-slate-400">
              {history.length} logged entries
            </span>
          </div>

          {history.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
              <Scale className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-60" />
              No body weight entries recorded yet. Enter your weight on the left to start tracking your physique progress!
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-200/80 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5 pl-3.5">Date</th>
                    <th className="p-2.5">Weight</th>
                    <th className="p-2.5">Notes</th>
                    <th className="p-2.5 pr-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[...history].reverse().slice(0, 7).map((item, idx, arr) => {
                    const prevItem = arr[idx + 1];
                    const diff = prevItem ? item.weight - prevItem.weight : null;

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                          item.date === selectedDate ? 'bg-teal-50/50 dark:bg-teal-950/20' : ''
                        }`}
                      >
                        <td className="p-2.5 pl-3.5 font-semibold text-slate-800 dark:text-slate-200">
                          {formatShortDate(item.date)}
                          {item.date === selectedDate && (
                            <span className="ml-1.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                              Selected
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                          <span>{item.weight} {item.unit}</span>
                          {diff !== null && (
                            <span
                              className={`ml-1.5 text-[10px] font-semibold ${
                                diff < 0 ? 'text-teal-600' : diff > 0 ? 'text-amber-600' : 'text-slate-400'
                              }`}
                            >
                              ({diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)})
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-500 truncate max-w-[150px]">
                          {item.notes || '—'}
                        </td>
                        <td className="p-2.5 pr-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteWeight(item.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
