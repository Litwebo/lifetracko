import React, { useState } from 'react';
import { ShieldCheck, Lock, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface AdminAccessPromptProps {
  forceShow?: boolean;
}

export function AdminAccessPrompt({ forceShow = false }: AdminAccessPromptProps) {
  const { user, setAdminAccess } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only relevant for Member accounts
  if (!user || user.role !== 'MEMBER') return null;

  // If already decided and not forced to show, do not render intrusive banner
  if (user.adminAccessDecided && !forceShow) return null;

  const handleDecision = async (allow: boolean) => {
    setIsSubmitting(true);
    try {
      await setAdminAccess(allow);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 border border-indigo-800/60 shadow-lg relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 shrink-0 mt-0.5 sm:mt-0">
            {user.allowAdminView ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Data Privacy & Admin Access Permission
              </h3>
              {user.adminAccessDecided && (
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    user.allowAdminView
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {user.allowAdminView ? 'Access Granted' : 'Data Private'}
                </span>
              )}
            </div>
            <p className="text-xs text-indigo-200/90 mt-1 max-w-2xl leading-relaxed">
              Do you want to allow system administrators to view your daily calorie & protein intake, body weight entries, and financial records? You retain complete control and can change this preference anytime.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleDecision(false)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              user.adminAccessDecided && !user.allowAdminView
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-500/30'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            Keep Data Private
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleDecision(true)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              user.adminAccessDecided && user.allowAdminView
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Grant Admin Access
          </button>
        </div>
      </div>
    </div>
  );
}
