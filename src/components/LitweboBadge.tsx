import React from 'react';
import { Instagram, Sparkles, ExternalLink } from 'lucide-react';

interface LitweboBadgeProps {
  variant?: 'top-bar' | 'pill' | 'card' | 'compact';
  className?: string;
}

export function LitweboBadge({ variant = 'pill', className = '' }: LitweboBadgeProps) {
  if (variant === 'top-bar') {
    return (
      <div className={`w-full bg-slate-950/95 text-white py-1 px-4 border-b border-emerald-500/20 shadow-sm relative overflow-hidden backdrop-blur-md ${className}`}>
        {/* Subtle ambient light glow behind bar */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-96 h-16 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-purple-500/20 blur-xl pointer-events-none" />

        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 hover:border-emerald-400/40 transition-all duration-300 litwebo-badge-shimmer group cursor-default">
              <Sparkles className="w-3 h-3 text-emerald-400 animate-spin-slow" />
              <span className="text-[11px] text-slate-300">
                created by{' '}
                <span className="litwebo-gradient-text font-black tracking-wide text-xs group-hover:scale-105 inline-block transition-transform">
                  @litweb0
                </span>
              </span>
              <span className="relative flex h-1.5 w-1.5 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
            </div>
          </div>

          <a
            href="https://www.instagram.com/litweb0"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-1.5 text-[11px] font-bold text-white px-3 py-0.5 rounded-full bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-emerald-500/20 hover:from-pink-500/35 hover:via-purple-500/35 hover:to-emerald-500/35 border border-white/15 hover:border-pink-400/50 shadow-xs transition-all duration-300 hover:scale-[1.03] active:scale-95"
            title="Follow @litweb0 on Instagram"
          >
            <div className="w-3.5 h-3.5 rounded-sm bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 flex items-center justify-center text-white shadow-2xs group-hover:rotate-12 transition-transform duration-300">
              <Instagram className="w-2.5 h-2.5" />
            </div>
            <span className="text-pink-200 group-hover:text-white transition-colors">
              @litweb0
            </span>
            <ExternalLink className="w-2.5 h-2.5 text-pink-300/80 group-hover:text-pink-100 group-hover:translate-x-0.5 transition-all" />
          </a>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`relative group p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white border border-slate-800 hover:border-emerald-500/40 shadow-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-emerald-500/10 ${className}`}>
        {/* Background ambient neon glow */}
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-pink-500/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />

        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 via-cyan-400 to-indigo-500 p-0.5 shadow-md">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-emerald-400 group-hover:rotate-12 transition-transform duration-300" />
                </div>
              </div>
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
              </span>
            </div>

            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Creator & Developer</p>
              <h4 className="litwebo-gradient-text text-base font-black tracking-tight">
                @litweb0
              </h4>
            </div>
          </div>

          <a
            href="https://www.instagram.com/litweb0"
            target="_blank"
            rel="noopener noreferrer"
            title="Follow @litweb0 on Instagram"
            aria-label="Follow @litweb0 on Instagram"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500 shadow-md shadow-pink-600/20 hover:shadow-pink-600/40 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <Instagram className="w-3.5 h-3.5" />
            <span>Connect</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <a
        href="https://www.instagram.com/litweb0"
        target="_blank"
        rel="noopener noreferrer"
        title="Follow @litweb0 on Instagram"
        aria-label="Follow @litweb0 on Instagram"
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/90 dark:bg-slate-950/90 border border-slate-700/60 dark:border-slate-800 hover:border-emerald-500/50 litwebo-badge-shimmer transition-all duration-300 hover:scale-105 group shadow-xs ${className}`}
      >
        <Sparkles className="w-3 h-3 text-emerald-400 group-hover:rotate-45 transition-transform duration-300" />
        <span className="text-xs text-slate-300">
          crafted with <span className="text-rose-500 inline-block animate-pulse">♥</span> by{' '}
          <span className="litwebo-gradient-text font-black text-xs">@litweb0</span>
        </span>
      </a>
    );
  }

  // Default 'pill' variant
  return (
    <div className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/90 dark:bg-slate-950/90 border border-slate-700/60 dark:border-slate-800 shadow-md litwebo-badge-shimmer backdrop-blur-md group hover:border-emerald-500/50 hover:shadow-emerald-500/20 transition-all duration-300 hover:scale-[1.02] ${className}`}>
      {/* Dynamic glow aura */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="flex items-center gap-1.5 relative z-10 shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-emerald-400 group-hover:text-cyan-300 transition-colors animate-pulse shrink-0" />
        <span className="text-xs text-slate-300 whitespace-nowrap">
          created by{' '}
          <span className="litwebo-gradient-text font-black tracking-wide text-xs inline-block">
            @litweb0
          </span>
        </span>
      </div>

      <span className="text-slate-600 dark:text-slate-700 relative z-10 shrink-0">•</span>

      <a
        href="https://www.instagram.com/litweb0"
        target="_blank"
        rel="noopener noreferrer"
        title="Follow @litweb0 on Instagram"
        aria-label="Follow @litweb0 on Instagram"
        className="relative z-10 inline-flex items-center gap-1 text-xs font-bold text-pink-400 hover:text-pink-300 transition-colors group/link shrink-0"
      >
        <Instagram className="w-3 h-3 text-pink-400 group-hover/link:rotate-12 transition-transform duration-200" />
        <span>@litweb0</span>
        <ExternalLink className="w-2.5 h-2.5 opacity-70 group-hover/link:opacity-100 group-hover/link:translate-x-0.5 transition-all" />
      </a>
    </div>
  );
}
