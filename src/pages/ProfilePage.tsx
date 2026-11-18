import React, { useState } from 'react';
import { User as UserIcon, Mail, Shield, Flame, Dumbbell, Calendar, Save, Check, Keyboard, Lock, Unlock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { formatShortDate } from '../lib/utils.ts';

export function ProfilePage() {
  const { user, getAuthHeaders, updateUserData, setAdminAccess } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name || '');
  const [dailyCalories, setDailyCalories] = useState(String(user?.dailyCalories || 2200));
  const [dailyProtein, setDailyProtein] = useState(String(user?.dailyProtein || 120));
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }

    const cal = parseInt(dailyCalories, 10);
    const prot = parseFloat(dailyProtein);

    if (isNaN(cal) || cal < 500 || cal > 15000) {
      toast.error('Please enter a realistic daily calorie goal (e.g. 1500 - 4000 kcal).');
      return;
    }

    if (isNaN(prot) || prot < 10 || prot > 500) {
      toast.error('Please enter a realistic protein goal (e.g. 50 - 250 g).');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          dailyCalories: cal,
          dailyProtein: prot,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update profile.');
        return;
      }

      updateUserData({
        name: name.trim(),
        dailyCalories: cal,
        dailyProtein: prot,
      });

      toast.success('Profile and nutrition targets updated successfully!');
    } catch (err) {
      toast.error('Network error saving profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAdminAccess = async (allow: boolean) => {
    setIsUpdatingAccess(true);
    try {
      const result = await setAdminAccess(allow);
      if (!result.success) {
        toast.error(result.error || 'Failed to update access settings.');
      }
    } catch (err) {
      toast.error('Error connecting to database.');
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Member Profile & Nutrition Targets
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Customize your personal details and set your daily macro targets.
        </p>

        {user?.isDemo && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
            <span className="shrink-0 font-bold uppercase text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40">
              Demo Account
            </span>
            <span>You are previewing LifeTracko in Demo Member Mode. Target changes are applied in-memory and will not be stored permanently.</span>
          </div>
        )}

        {/* Identity Badge Header */}
        <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-500 text-white font-black text-xl flex items-center justify-center shadow-md">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{user?.name}</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                {user?.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> {user?.email}
            </p>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20">
              <label className="block text-xs font-bold text-amber-800 dark:text-amber-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-600" /> Daily Calorie Goal (kcal)
                </span>
                <span className="text-[10px] text-slate-400 font-normal flex items-center gap-0.5">
                  <Keyboard className="w-3 h-3" /> Keyboard
                </span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={dailyCalories}
                onChange={(e) => setDailyCalories(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 2200"
                required
                className="w-full px-3.5 py-2 text-base bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Your daily target for nutrition progress bars.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20">
              <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Dumbbell className="w-4 h-4 text-emerald-600" /> Daily Protein Goal (grams)
                </span>
                <span className="text-[10px] text-slate-400 font-normal flex items-center gap-0.5">
                  <Keyboard className="w-3 h-3" /> Keyboard
                </span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={dailyProtein}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  if ((val.match(/\./g) || []).length <= 1) {
                    setDailyProtein(val);
                  }
                }}
                placeholder="e.g. 120"
                required
                className="w-full px-3.5 py-2 text-base bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Muscle recovery & macro target in grams.
              </p>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Member Privacy & Admin Consent Section */}
      {user?.role === 'MEMBER' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
              user?.allowAdminView 
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400' 
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400'
            }`}>
              {user?.allowAdminView ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Administrative Access Authorization</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Control whether administrators can inspect your meal logs, weight statistics, and expense ledgers.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <p>
              By default, all user data is fully encrypted and sandboxed. When access is <strong className="text-rose-600 dark:text-rose-400">disabled</strong>, admins will see a restriction wall and will be strictly locked out from reading your private logs.
            </p>
            <p>
              Enable this option only if you would like support admins to analyze your calorie logs or help troubleshoot your spending transactions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Grant Review Permission</span>
              <p className="text-[11px] text-slate-400">Updates live in the database instantly.</p>
            </div>

            <button
              disabled={isUpdatingAccess}
              onClick={() => handleToggleAdminAccess(!user?.allowAdminView)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border self-start sm:self-auto ${
                user?.allowAdminView
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${user?.allowAdminView ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
              <span>
                {isUpdatingAccess ? 'Updating...' : user?.allowAdminView ? 'Access Granted' : 'Access Private'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
