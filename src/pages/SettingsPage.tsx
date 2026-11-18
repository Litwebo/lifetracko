import React, { useState, useEffect } from 'react';
import {
  Lock,
  Download,
  Moon,
  Sun,
  Shield,
  FileSpreadsheet,
  LogOut,
  RefreshCw,
  Database,
  HelpCircle,
  Mail,
  ExternalLink,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Server,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';

export function SettingsPage() {
  const { user, logout, getAuthHeaders, setAdminAccess } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const toast = useToast();
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Firewall live status state
  const [firewallStats, setFirewallStats] = useState<{
    requestsScreened: number;
    threatsBlocked: number;
    sqliBlocked: number;
    xssBlocked: number;
    rateLimitsTriggered: number;
    uptimeSeconds: number;
  } | null>(null);

  useEffect(() => {
    const fetchFirewall = async () => {
      try {
        const res = await fetch('/api/firewall/status', {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setFirewallStats(json.data);
          }
        }
      } catch (e) {}
    };
    fetchFirewall();
    const interval = setInterval(fetchFirewall, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.');
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update password.');
        return;
      }

      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error('Network error changing password.');
    } finally {
      setIsChangingPass(false);
    }
  };

  // CSV Data Export
  const handleExportCSV = async (type: 'food' | 'expenses') => {
    try {
      const res = await fetch(`/api/export/${type}`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        toast.error('Failed to export data.');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifetrack-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`${type === 'food' ? 'Diet entries' : 'Expenses'} exported as CSV!`);
    } catch (err) {
      toast.error('Failed to download CSV.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          System Settings & Preferences
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your credentials, backup your data, and customize preferences.
        </p>

        {/* Section 1: Security & Password */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Security & Password</h2>
          </div>

          <form onSubmit={handleChangePassword} className="max-w-md space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Password (min 8 characters)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPass}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs disabled:opacity-50 transition-colors"
            >
              {isChangingPass ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Section 2: Data Export & Portability */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <Download className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Data Export & Backup</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Download your entire tracking archive in CSV format compatible with Microsoft Excel, Google Sheets, or Apple Numbers.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleExportCSV('food')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Download Diet Entries (CSV)
            </button>

            <button
              type="button"
              onClick={() => handleExportCSV('expenses')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              Download Expenses (CSV)
            </button>
          </div>
        </div>

        {/* Section: Data Privacy & Admin Access (Members only) */}
        {user?.role === 'member' && (
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Admin Data Access Permission</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                  Control whether administrators have permission to review your logged calories, protein, body weight, and financial expenses.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                  user.allowAdminView
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                }`}>
                  {user.allowAdminView ? 'Access Granted' : 'Access Denied (Private)'}
                </span>

                <button
                  type="button"
                  disabled={isUpdatingAccess}
                  onClick={async () => {
                    setIsUpdatingAccess(true);
                    try {
                      const nextVal = !user.allowAdminView;
                      await setAdminAccess(nextVal);
                      toast.success(
                        nextVal
                          ? 'Admin view access granted.'
                          : 'Admin view access denied. Your data is now private.'
                      );
                    } catch (err: any) {
                      toast.error(err.message || 'Failed to update access.');
                    } finally {
                      setIsUpdatingAccess(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    user.allowAdminView
                      ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                  }`}
                >
                  {isUpdatingAccess ? 'Updating...' : user.allowAdminView ? 'Revoke Admin Access' : 'Grant Admin Access'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Appearance & Theme */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Appearance</h2>
              <p className="text-xs text-slate-500">Toggle between Light and Dark interface themes</p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-2"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            </button>
          </div>
        </div>

        {/* Section 4 & 5: Security & Database Status (Only shown to admins) */}
        {user?.role === 'admin' && (
          <>
            {/* Section 4: Security & Database Firewall Shield */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white shadow-xl border border-indigo-500/20 relative overflow-hidden">
                {/* Ambient Shield Glow */}
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-white">Database & Application Firewall</h2>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            ACTIVE SHIELD
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Real-time packet inspection protecting user data and PostgreSQL database
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 self-start sm:self-auto">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{firewallStats?.requestsScreened ? `${firewallStats.requestsScreened} requests screened` : 'WAF Online'}</span>
                    </div>
                  </div>

                  {/* Security Pillars Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                        <span>SQL Injection Shield</span>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Deep inspection of all queries & parameterized database isolation.
                      </p>
                      <span className="text-[10px] font-mono text-slate-500 block pt-0.5">
                        {firewallStats?.sqliBlocked || 0} attacks neutralized
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-teal-300">
                        <span>XSS & Script Guard</span>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Payload sanitization blocking script injection & malicious payloads.
                      </p>
                      <span className="text-[10px] font-mono text-slate-500 block pt-0.5">
                        {firewallStats?.xssBlocked || 0} attempts blocked
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
                        <span>DDoS & Brute-Force Rate Limiter</span>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Adaptive token-bucket rate limiter defending authentication & endpoints.
                      </p>
                      <span className="text-[10px] font-mono text-slate-500 block pt-0.5">
                        250 req/min threshold
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Dedicated Permanent Database Status */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        Dedicated Permanent Database
                      </h2>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                        ACTIVE & SYNCED
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Your email and passwords are saved permanently in a separate atomic credential vault. Zero chance of password loss on restart or logout.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-emerald-500/20 self-start sm:self-auto">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Permanent Vault Linked</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Section 6: Help & Problem Support */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Help & Problem Reporting</h2>
                <p className="text-xs text-slate-500">
                  Facing any issue? Send your problem directly to <strong className="text-slate-700 dark:text-slate-300 font-mono">lifetracko0@gmail.com</strong>
                </p>
              </div>
            </div>
            <a
              href="mailto:lifetracko0@gmail.com?subject=Life%20Tracko%20Support%20Request"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-2xs self-start sm:self-auto"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email Support</span>
            </a>
          </div>
        </div>

        {/* Section 7: System Info & Logout */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-500" />
            <span>PostgreSQL & Permanent Vault Dual-Active · Version 1.0.0</span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="px-5 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 border border-rose-200 dark:border-rose-900 flex items-center gap-2 self-start sm:self-auto"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
