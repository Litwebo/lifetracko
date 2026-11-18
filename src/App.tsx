import { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { DietPage } from './pages/DietPage.tsx';
import { ExpensesPage } from './pages/ExpensesPage.tsx';
import { HistoryPage } from './pages/HistoryPage.tsx';
import { AnalyticsPage } from './pages/AnalyticsPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { HelpPage } from './pages/HelpPage.tsx';
import { LitweboBadge } from './components/LitweboBadge.tsx';

function MainApp() {
  const { user, isLoading, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Set default tab on login based on role
  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN' && !user.isDemo) {
        setCurrentTab((prev) =>
          ['admin-dashboard', 'admin-members', 'analytics', 'settings', 'help'].includes(prev)
            ? prev
            : 'admin-dashboard'
        );
      } else {
        setCurrentTab((prev) =>
          ['dashboard', 'diet', 'expenses', 'history', 'analytics', 'profile', 'settings', 'help'].includes(prev)
            ? prev
            : 'dashboard'
        );
      }
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-500 p-0.5 shadow-lg animate-pulse flex items-center justify-center">
            <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center font-black text-emerald-600 dark:text-emerald-400 text-lg">
              L₹
            </div>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading Life Tracko...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const renderCurrentView = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage onNavigateTab={setCurrentTab} />;
      case 'diet':
        return <DietPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'history':
        return (
          <HistoryPage
            onSelectDateToTrack={(_date) => {
              setCurrentTab('dashboard');
            }}
          />
        );
      case 'analytics':
        return <AnalyticsPage />;
      case 'profile':
        return <ProfilePage />;
      case 'settings':
        return <SettingsPage />;
      case 'help':
        return <HelpPage />;
      case 'admin-dashboard':
      case 'admin-members':
        // Strict protection: Demo users can NEVER view Admin pages
        if (user.isDemo || user.role !== 'ADMIN') {
          return <DashboardPage onNavigateTab={setCurrentTab} />;
        }
        return <AdminDashboardPage />;
      default:
        return <DashboardPage onNavigateTab={setCurrentTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors pb-16 lg:pb-0">
      <Navbar currentTab={currentTab} onSelectTab={setCurrentTab} />
      {user.isDemo && (
        <div className="w-full bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-950 dark:text-amber-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 truncate">
              <span className="shrink-0 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded-full border border-amber-500/40">
                Demo Member Mode
              </span>
              <span className="truncate text-slate-700 dark:text-slate-300">
                Exploring as a temporary member. No data is stored permanently — session resets automatically when you leave the app.
              </span>
            </div>
            <button
              onClick={logout}
              className="shrink-0 px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 transition-colors cursor-pointer"
            >
              Exit Demo
            </button>
          </div>
        </div>
      )}
      <main className="flex-1">{renderCurrentView()}</main>
      <footer className="w-full py-4 px-4 sm:px-6 lg:px-8 border-t border-slate-200/70 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p className="font-medium">Life Tracko — Daily Health, Nutrition & Financial Ledger</p>
          <LitweboBadge variant="compact" />
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
