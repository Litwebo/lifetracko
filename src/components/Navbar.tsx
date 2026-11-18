import { useState } from 'react';
import {
  LayoutDashboard,
  Utensils,
  Wallet,
  Calendar,
  BarChart3,
  User,
  Settings,
  ShieldCheck,
  HelpCircle,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { AppLogo } from './AppLogo.tsx';
import { LitweboBadge } from './LitweboBadge.tsx';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export function Navbar({ currentTab, onSelectTab }: NavbarProps) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const memberTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'diet', label: 'Diet', icon: Utensils },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'history', label: 'History', icon: Calendar },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help', icon: HelpCircle },
  ];

  const adminTabs = [
    { id: 'admin-dashboard', label: 'Admin Dashboard', icon: ShieldCheck },
    { id: 'admin-members', label: 'Members', icon: User },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help', icon: HelpCircle },
  ];

  const tabs = isAdmin ? adminTabs : memberTabs;

  return (
    <>
      <header className="sticky top-0 z-40 w-full transition-colors">
        {/* Top Creator Announcement Bar with Litwebo Holographic Effects */}
        <LitweboBadge variant="top-bar" />

        <div className="w-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center gap-2">
              <AppLogo
                size="md"
                onClick={() => onSelectTab(isAdmin ? 'admin-dashboard' : 'dashboard')}
              />
              {isAdmin && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 rounded-full border border-amber-300 dark:border-amber-800">
                  Admin
                </span>
              )}
              {user?.isDemo && (
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500/15 to-emerald-500/15 text-amber-700 dark:text-amber-300 rounded-full border border-amber-400/40 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Demo Member
                </span>
              )}
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden lg:flex items-center gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`nav-tab-${tab.id}`}
                    onClick={() => onSelectTab(tab.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* User Controls & Actions */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                id="theme-toggle-btn"
                onClick={toggleTheme}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* User Avatar & Logout */}
              {user && (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                  <div
                    onClick={() => onSelectTab('profile')}
                    title="View Profile"
                    className="flex items-center gap-2.5 cursor-pointer py-1 px-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center border border-emerald-300 dark:border-emerald-700">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="hidden md:block text-left">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate max-w-[120px]">
                        {user.name}
                      </p>
                      <p className="text-[10px] text-slate-400 leading-tight capitalize">
                        {user.isDemo ? 'Demo Member' : user.role.toLowerCase()}
                      </p>
                    </div>
                  </div>

                  {user.isDemo ? (
                    <button
                      id="exit-demo-btn"
                      onClick={logout}
                      title="Exit Demo session (all temporary data will be wiped)"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-300 dark:border-rose-800 transition-colors cursor-pointer shadow-xs"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Exit Demo</span>
                    </button>
                  ) : (
                    <button
                      id="logout-btn"
                      onClick={logout}
                      title="Sign Out"
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Mobile Menu Toggle */}
              <button
                id="mobile-menu-toggle"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-3 pb-5 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    onSelectTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Bottom Navigation for Mobile Devices */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1 flex justify-around items-center">
        {isAdmin ? (
          <>
            <button
              onClick={() => onSelectTab('admin-dashboard')}
              className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium ${
                currentTab === 'admin-dashboard' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500'
              }`}
            >
              <ShieldCheck className="w-5 h-5 mb-0.5" />
              Overview
            </button>
            <button
              onClick={() => onSelectTab('admin-members')}
              className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium ${
                currentTab === 'admin-members' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500'
              }`}
            >
              <User className="w-5 h-5 mb-0.5" />
              Members
            </button>
            <button
              onClick={() => onSelectTab('analytics')}
              className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium ${
                currentTab === 'analytics' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500'
              }`}
            >
              <BarChart3 className="w-5 h-5 mb-0.5" />
              Analytics
            </button>
            <button
              onClick={() => onSelectTab('settings')}
              className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium ${
                currentTab === 'settings' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500'
              }`}
            >
              <Settings className="w-5 h-5 mb-0.5" />
              Settings
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium ${
                currentTab === 'dashboard' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mb-0.5" />
              Home
            </button>
            <button
              onClick={() => onSelectTab('diet')}
              className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium ${
                currentTab === 'diet' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500'
              }`}
            >
              <Utensils className="w-5 h-5 mb-0.5" />
              Diet
            </button>
            <button
              onClick={() => onSelectTab('expenses')}
              className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium ${
                currentTab === 'expenses' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500'
              }`}
            >
              <Wallet className="w-5 h-5 mb-0.5" />
              Money
            </button>
            <button
              onClick={() => onSelectTab('history')}
              className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium ${
                currentTab === 'history' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500'
              }`}
            >
              <Calendar className="w-5 h-5 mb-0.5" />
              History
            </button>
            <button
              onClick={() => onSelectTab('analytics')}
              className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium ${
                currentTab === 'analytics' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500'
              }`}
            >
              <BarChart3 className="w-5 h-5 mb-0.5" />
              Stats
            </button>
          </>
        )}
      </nav>
    </>
  );
}
