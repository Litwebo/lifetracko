import React, { useState, useEffect, useRef } from 'react';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Flame,
  Wallet,
  Calendar,
  CheckCircle2,
  Lock,
  Mail,
  User,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Sun,
  Moon,
  KeyRound,
  RotateCcw,
  Check,
  AlertCircle,
  HelpCircle,
  Database,
  Send,
  X,
  Shield,
  Server,
  Zap,
} from 'lucide-react';
import { AppLogo } from '../components/AppLogo.tsx';
import { LitweboBadge } from '../components/LitweboBadge.tsx';
import { Role } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';

export function AuthPage() {
  const { login, loginWithGoogle, loginAsDemo, register } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const toast = useToast();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [role, setRole] = useState<Role>('MEMBER');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [savedEmails, setSavedEmails] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [capsLockActive, setCapsLockActive] = useState(false);

  // Permanent Database Status
  const [dbStatus, setDbStatus] = useState<{
    healthy: boolean;
    userCount: number;
    lastSynced?: string;
  }>({
    healthy: true,
    userCount: 1,
  });

  // Support / Help Modal State
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportName, setSupportName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportCategory, setSupportCategory] = useState('Login & Access');
  const [supportMessage, setSupportMessage] = useState('');
  const [isSendingSupport, setIsSendingSupport] = useState(false);

  // Load remembered email, saved Gmail accounts, and DB status on mount
  useEffect(() => {
    try {
      const remembered = localStorage.getItem('lifetrack_remembered_email');
      if (remembered) {
        setEmail(remembered);
      }
      const savedListStr = localStorage.getItem('lifetrack_saved_emails');
      if (savedListStr) {
        const parsed = JSON.parse(savedListStr);
        if (Array.isArray(parsed)) {
          setSavedEmails(parsed);
        }
      }
    } catch {}

    // Check Permanent Auth Database Status
    fetch('/api/auth/database-status')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.data) {
          setDbStatus({
            healthy: Boolean(data.data.healthy),
            userCount: Number(data.data.totalUsersVaulted || 1),
            lastSynced: data.data.lastSynced,
          });
        }
      })
      .catch(() => {});
  }, []);

  const saveEmailToStorage = (cleanEmail: string) => {
    if (rememberMe) {
      localStorage.setItem('lifetrack_remembered_email', cleanEmail);
    } else {
      localStorage.removeItem('lifetrack_remembered_email');
    }

    try {
      const existingStr = localStorage.getItem('lifetrack_saved_emails');
      let list: string[] = existingStr ? JSON.parse(existingStr) : [];
      if (!Array.isArray(list)) list = [];
      list = [cleanEmail, ...list.filter((e) => e.toLowerCase() !== cleanEmail.toLowerCase())].slice(0, 5);
      localStorage.setItem('lifetrack_saved_emails', JSON.stringify(list));
      setSavedEmails(list);
    } catch {}
  };

  // Keyboard CapsLock detection helper
  const checkCapsLock = (e: React.KeyboardEvent) => {
    setCapsLockActive(e.getModifierState('CapsLock'));
  };

  // Clear errors on field changes
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (formError) setFormError(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (formError) setFormError(null);
  };

  // Forgot password 4-digit code & reset states
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '']);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const otpInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Resend countdown effect
  useEffect(() => {
    let interval: any = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Password strength checks (for registration)
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const strengthScore = [hasMinLength, hasUpper, hasLower, hasNumber].filter(Boolean).length;

  const getStrengthLabel = () => {
    if (password.length === 0) return { label: '', color: 'bg-slate-200 dark:bg-slate-700' };
    if (strengthScore <= 1) return { label: 'Weak', color: 'bg-rose-500' };
    if (strengthScore <= 2) return { label: 'Fair', color: 'bg-amber-500' };
    if (strengthScore === 3) return { label: 'Good', color: 'bg-indigo-500' };
    return { label: 'Strong', color: 'bg-emerald-500' };
  };

  // Password strength checks (for reset)
  const resetHasMinLength = newResetPassword.length >= 8;
  const resetHasUpper = /[A-Z]/.test(newResetPassword);
  const resetHasLower = /[a-z]/.test(newResetPassword);
  const resetHasNumber = /[0-9]/.test(newResetPassword);
  const resetStrengthScore = [resetHasMinLength, resetHasUpper, resetHasLower, resetHasNumber].filter(Boolean).length;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFormError('Please enter your email address.');
      toast.error('Please enter your email address.');
      return;
    }
    if (!password) {
      setFormError('Please enter your password.');
      toast.error('Please enter your password.');
      return;
    }

    setIsLoading(true);
    const result = await login(cleanEmail, password, role);
    setIsLoading(false);

    if (!result.success && result.error) {
      setFormError(result.error);
      toast.error(result.error);
    } else {
      saveEmailToStorage(cleanEmail);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      setFormError('Please fill in all registration fields.');
      toast.error('Please fill in all registration fields.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please verify your password.');
      toast.error('Passwords do not match.');
      return;
    }
    if (strengthScore < 4) {
      setFormError('Please choose a stronger password (8+ characters, uppercase, lowercase, and a number).');
      toast.error('Please choose a stronger password.');
      return;
    }

    setIsLoading(true);
    const result = await register(cleanName, cleanEmail, password, confirmPassword);
    setIsLoading(false);

    if (!result.success && result.error) {
      setFormError(result.error);
      toast.error(result.error);
    } else {
      saveEmailToStorage(cleanEmail);
      toast.success('Account created! Your credentials are permanently secured in the database.');
    }
  };

  // Request 4-Digit Code
  const handleForgotRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      toast.error('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) {
        toast.error(data.error || 'Failed to send verification code.');
        return;
      }

      toast.success(data.message || `4-digit code sent to ${cleanEmail}!`);
      setResetStep('verify');
      setResendTimer(30);

      // Focus first OTP digit
      setTimeout(() => {
        otpInputRefs[0].current?.focus();
      }, 150);
    } catch (err) {
      setIsLoading(false);
      toast.error('Network error requesting reset code.');
    }
  };

  // Handle OTP digit inputs
  const handleOtpChange = (index: number, val: string) => {
    // Handle paste of 4-digit code
    if (val.length > 1) {
      const cleaned = val.replace(/\D/g, '').slice(0, 4);
      if (cleaned.length > 0) {
        const newDigits = ['', '', '', ''];
        for (let i = 0; i < cleaned.length; i++) {
          newDigits[i] = cleaned[i];
        }
        setOtpDigits(newDigits);
        const nextIndex = Math.min(cleaned.length, 3);
        otpInputRefs[nextIndex].current?.focus();
      }
      return;
    }

    const digit = val.replace(/\D/g, '');
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    // Auto-advance to next input box
    if (digit && index < 3) {
      otpInputRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs[index - 1].current?.focus();
    }
  };

  // Verify 4-digit code and renew password
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otpDigits.join('').trim();

    if (fullCode.length !== 4) {
      toast.error('Please enter the full 4-digit verification code.');
      return;
    }

    if (!newResetPassword || !confirmResetPassword) {
      toast.error('Please enter and confirm your new password.');
      return;
    }

    if (newResetPassword !== confirmResetPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    if (resetStrengthScore < 4) {
      toast.error('Password must have 8+ characters, uppercase, lowercase, and a number.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: fullCode,
          newPassword: newResetPassword,
          confirmPassword: confirmResetPassword,
        }),
      });
      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) {
        toast.error(data.error || 'Failed to reset password.');
        return;
      }

      toast.success('Your password has been permanently renewed! Please sign in.');
      setPassword(newResetPassword);
      setMode('login');
      setResetStep('request');
      setOtpDigits(['', '', '', '']);
      setNewResetPassword('');
      setConfirmResetPassword('');
    } catch (err) {
      setIsLoading(false);
      toast.error('Network error executing password reset.');
    }
  };

  // Submit User Help Request to lifetracko0@gmail.com
  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportEmail.trim() || !supportMessage.trim()) {
      toast.error('Please provide your email address and message.');
      return;
    }

    setIsSendingSupport(true);
    try {
      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: supportName.trim() || 'LifeTracko User',
          email: supportEmail.trim(),
          category: supportCategory,
          subject: `[Support Request] ${supportCategory}`,
          message: supportMessage.trim(),
        }),
      });

      const data = await res.json();
      setIsSendingSupport(false);

      if (res.ok) {
        toast.success('Your help request has been sent to lifetracko0@gmail.com!');
        setIsSupportModalOpen(false);
        setSupportMessage('');
      } else {
        toast.error(data.error || 'Failed to send help request.');
      }
    } catch (err) {
      setIsSendingSupport(false);
      toast.error('Network error sending help request.');
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Left Column: Visual Brand Experience */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-950 via-slate-900 to-indigo-950 p-12 flex-col justify-between relative overflow-hidden text-white">
        {/* Ambient Glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header & Top Creator Credit */}
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <AppLogo size="xl" />
          </div>

          {/* Top Creator Tag with Litwebo Holographic Effects */}
          <div>
            <LitweboBadge variant="pill" />
          </div>
        </div>

        {/* Feature Visual Highlights */}
        <div className="relative z-10 space-y-6 my-auto max-w-lg">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5" /> All-in-One Daily Tracker
            </span>
            <h2 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight">
              Track your health. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300">
                Manage your money.
              </span> <br />
              Improve every day.
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Consolidate your daily food intake, calorie & protein targets, daily cash balance, and real expenses into a single unified dashboard.
            </p>
          </div>

          {/* Value Cards */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="p-2 w-fit rounded-xl bg-emerald-500/20 text-emerald-400 mb-2.5">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm">Nutrition Engine</h3>
              <p className="text-xs text-slate-400 mt-1">
                Calculate calories, macro protein, and monitor goals per meal.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="p-2 w-fit rounded-xl bg-indigo-500/20 text-indigo-400 mb-2.5">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm">₹ Financial Ledger</h3>
              <p className="text-xs text-slate-400 mt-1">
                Track daily cash in hand, expenses, and verify discrepancies.
              </p>
            </div>
          </div>

          {/* Permanent Database Pillar Card */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 backdrop-blur-md flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-300">Dedicated Permanent Database</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <p className="text-slate-300 text-[11px] mt-0.5">
                Email and passwords are permanently safeguarded with zero loss across sessions.
              </p>
            </div>
          </div>

          {/* Instant Member Demo Access (Ephemeral Session) */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-indigo-500/20 border border-emerald-400/30 backdrop-blur-md flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Want to test the app first?</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                Instant Member Demo with pre-loaded diet & expenses. No data stored permanently.
              </p>
            </div>
            <button
              type="button"
              onClick={loginAsDemo}
              className="shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <span>Try Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Left Column Bottom Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-6">
          <span className="flex items-center gap-1.5">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Encrypted Permanent Vault Active</span>
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> End-to-End Secure
          </span>
        </div>
      </div>

      {/* Right Column: Interactive Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12 relative min-h-screen">
        <div className="max-w-md w-full my-auto py-2 sm:py-4">
          {/* Top Control Bar: Help & Theme Toggle (Cleanly separated in document flow, zero overlap) */}
          <div className="w-full flex items-center justify-between gap-2 mb-3.5">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Life Tracko Web</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="auth-help-btn"
                onClick={() => {
                  setSupportEmail(email || '');
                  setIsSupportModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-emerald-500/40 transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Need Help?</span>
              </button>

              <button
                type="button"
                id="auth-theme-toggle-btn"
                onClick={toggleTheme}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-amber-400/50 transition-all shadow-2xs active:scale-95 cursor-pointer"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Top Creator Banner with Litwebo Holographic Effects (Positioned properly with clear spacing) */}
          <div className="mb-4">
            <LitweboBadge variant="pill" className="w-full justify-between py-2 px-3 sm:px-3.5" />
          </div>

          {/* Mobile Header */}
          <div className="lg:hidden mb-5 flex justify-center">
            <AppLogo size="lg" />
          </div>

          {/* Mode Navigation / Tabs */}
          {mode !== 'forgot' && (
            <div className="flex items-center justify-between mb-5 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setFormError(null);
                  }}
                  className={`text-sm font-bold pb-2 transition-colors relative ${
                    mode === 'login'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  Sign In
                  {mode === 'login' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                  )}
                </button>
                {role === 'MEMBER' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setFormError(null);
                    }}
                    className={`text-sm font-bold pb-2 transition-colors relative ${
                      mode === 'register'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    Create Account
                    {mode === 'register' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                    )}
                  </button>
                )}
              </div>

              {/* Role Switcher Pill */}
              {mode === 'login' && (
                <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('MEMBER');
                      setFormError(null);
                    }}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      role === 'MEMBER'
                        ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    Member
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRole('ADMIN');
                      setFormError(null);
                    }}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      role === 'ADMIN'
                        ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    Admin
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Form Content: Login */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Member Demo Quick Access Card */}
              {role === 'MEMBER' && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/30 dark:border-emerald-500/35 relative overflow-hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Instant Demo Member Access
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          No Sign-in
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                        Explore full health tracking, meals, expenses, and analytics with pre-loaded member records.
                      </p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        Temporary demo: Data is NOT stored permanently and is removed as soon as you leave.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={loginAsDemo}
                      className="shrink-0 px-3 py-1.5 text-xs font-extrabold rounded-xl text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer mt-0.5"
                    >
                      <span>Try Demo</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Admin Mode Informational Banner */}
              {role === 'ADMIN' && (
                <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <strong className="text-indigo-950 dark:text-indigo-200">Administrator Command Mode</strong>
                  </div>
                  <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80">
                    Access system member analytics, privacy audits, and master food database.
                  </p>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold pt-0.5">
                    ℹ️ Note: Demo access is available for Members only to protect administrative controls.
                  </p>
                </div>
              )}

              {/* Inline Error Alert Banner */}
              {formError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Authentication Notice</p>
                    <p className="opacity-90">{formError}</p>
                  </div>
                </div>
              )}

              {/* Quick Select Saved Gmail / Accounts */}
              {savedEmails.length > 0 && (
                <div className="p-3 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/15 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Quick Select Saved Account
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem('lifetrack_saved_emails');
                        localStorage.removeItem('lifetrack_remembered_email');
                        setSavedEmails([]);
                        setEmail('');
                      }}
                      className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      Clear Saved
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {savedEmails.map((savedEmail) => (
                      <button
                        key={savedEmail}
                        type="button"
                        onClick={() => {
                          setEmail(savedEmail);
                          setFormError(null);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-xl transition-all font-medium flex items-center gap-1.5 border ${
                          email.toLowerCase() === savedEmail.toLowerCase()
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                        }`}
                      >
                        <Mail className="w-3 h-3 opacity-70" />
                        <span>{savedEmail}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Your account credentials and records are permanently stored in database.</span>
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {role === 'ADMIN' ? 'Admin Password' : 'Password'}
                  </label>
                  {capsLockActive && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      ⚠️ Caps Lock is ON
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={handlePasswordChange}
                    onKeyDown={checkCapsLock}
                    onKeyUp={checkCapsLock}
                    placeholder={role === 'ADMIN' ? 'Enter admin password' : '••••••••'}
                    required
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot Password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">Remember me</span>
                </label>

                {role === 'MEMBER' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setResetStep('request');
                      setFormError(null);
                    }}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Forgot Password?
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">
                    Admin access secured
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Signing In...
                  </>
                ) : (
                  <>
                    Sign In as {role === 'ADMIN' ? 'Administrator' : 'Member'} <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {role === 'MEMBER' && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-semibold">Or continue with</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      setIsLoading(true);
                      setFormError(null);
                      const res = await loginWithGoogle();
                      setIsLoading(false);
                      if (!res.success && res.error) {
                        setFormError(res.error);
                      }
                    }}
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all flex items-center justify-center gap-2.5 shadow-2xs cursor-pointer"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Sign In with Google</span>
                  </button>
                </>
              )}
            </form>
          )}

          {/* Form Content: Register (Member Only) */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              {/* Inline Error Alert Banner */}
              {formError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Registration Issue</p>
                    <p className="opacity-90">{formError}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    required
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  {capsLockActive && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      ⚠️ Caps Lock is ON
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={handlePasswordChange}
                    onKeyDown={checkCapsLock}
                    onKeyUp={checkCapsLock}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Strength:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {getStrengthLabel().label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`h-full flex-1 transition-all ${
                            step <= strengthScore ? getStrengthLabel().color : 'bg-transparent'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 pt-1">
                      <span className={hasMinLength ? 'text-emerald-600 font-semibold' : ''}>
                        ✓ 8+ Characters
                      </span>
                      <span className={hasUpper ? 'text-emerald-600 font-semibold' : ''}>
                        ✓ 1 Uppercase
                      </span>
                      <span className={hasLower ? 'text-emerald-600 font-semibold' : ''}>
                        ✓ 1 Lowercase
                      </span>
                      <span className={hasNumber ? 'text-emerald-600 font-semibold' : ''}>
                        ✓ 1 Number
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1">
                    Passwords do not match.
                  </p>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Your login credentials will be stored permanently in the dedicated database.</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? 'Creating Account...' : 'Create Member Account'}
              </button>
            </form>
          )}

          {/* Form Content: Forgot Password / 4-Digit Code Reset */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-emerald-500" />
                    <span>{resetStep === 'request' ? 'Forgot Password' : 'Enter 4-Digit Code'}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {resetStep === 'request'
                      ? 'Enter your registered Gmail to receive a 4-digit verification code.'
                      : `Code sent to ${email}. Enter code and choose a new password.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setResetStep('request');
                  }}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Back to Sign In
                </button>
              </div>

              {resetStep === 'request' ? (
                <form onSubmit={handleForgotRequest} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Your Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    <span>We will generate and dispatch a secure 4-digit verification code valid for 15 minutes.</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending 4-Digit Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Send 4-Digit Reset Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  {/* Verification Banner */}
                  <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Recipient Gmail
                      </span>
                      <button
                        type="button"
                        onClick={() => setResetStep('request')}
                        className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                      >
                        Change Email
                      </button>
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate">{email}</p>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <Mail className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span>Check your Gmail inbox for the 4-digit code sent from <strong>lifetracko0@gmail.com</strong></span>
                    </div>
                  </div>

                  {/* 4 Digit Boxes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 text-center">
                      Enter 4-Digit Verification Code
                    </label>
                    <div className="flex items-center justify-center gap-3">
                      {[0, 1, 2, 3].map((idx) => (
                        <input
                          key={idx}
                          ref={otpInputRefs[idx]}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={otpDigits[idx]}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          className="w-12 h-14 text-center text-2xl font-black font-mono rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 text-slate-900 dark:text-white outline-none transition-all shadow-sm"
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-center mt-2">
                      <button
                        type="button"
                        disabled={resendTimer > 0 || isLoading}
                        onClick={() => handleForgotRequest()}
                        className="text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{resendTimer > 0 ? `Resend Code in ${resendTimer}s` : 'Resend 4-Digit Code'}</span>
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        value={newResetPassword}
                        onChange={(e) => setNewResetPassword(e.target.value)}
                        placeholder="Enter new password (min 8 chars)"
                        required
                        className="w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Requirements checklist */}
                    {newResetPassword.length > 0 && (
                      <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 pt-1.5 px-0.5">
                        <span className={resetHasMinLength ? 'text-emerald-600 font-semibold' : ''}>
                          ✓ 8+ Characters
                        </span>
                        <span className={resetHasUpper ? 'text-emerald-600 font-semibold' : ''}>
                          ✓ 1 Uppercase
                        </span>
                        <span className={resetHasLower ? 'text-emerald-600 font-semibold' : ''}>
                          ✓ 1 Lowercase
                        </span>
                        <span className={resetHasNumber ? 'text-emerald-600 font-semibold' : ''}>
                          ✓ 1 Number
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        value={confirmResetPassword}
                        onChange={(e) => setConfirmResetPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        required
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Renewing Password...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Verify Code & Renew Password</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Help Request & Support Ticket Modal */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 max-w-lg w-full rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 relative">
            <button
              onClick={() => setIsSupportModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
              <HelpCircle className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Contact LifeTracko Support
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Need assistance logging in, resetting credentials, or reporting a bug? Send your request directly to <strong>lifetracko0@gmail.com</strong>.
            </p>

            <form onSubmit={handleSendSupport} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={supportName}
                  onChange={(e) => setSupportName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Your Email Address *
                </label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={supportCategory}
                  onChange={(e) => setSupportCategory(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="Login & Access">Login & Access</option>
                  <option value="Password Reset">Password Reset Issue</option>
                  <option value="Account Query">Account Management</option>
                  <option value="Bug Report">Bug or Technical Issue</option>
                  <option value="Other">Other Query</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Message Description *
                </label>
                <textarea
                  rows={4}
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  required
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSupportModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingSupport}
                  className="px-4 py-2 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm shadow-emerald-600/25 disabled:opacity-50"
                >
                  {isSendingSupport ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Send to lifetracko0@gmail.com
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
