import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Table as TableIcon,
  Search,
  RefreshCw,
  Download,
  Trash2,
  Edit,
  Terminal,
  Play,
  CheckCircle2,
  AlertCircle,
  Users,
  Utensils,
  Wallet,
  Shield,
  Key,
  Flame,
  Dumbbell,
  Clock,
  Layers,
  HelpCircle,
  Scale,
  Sparkles,
  UserX,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { DbTableInfo, DbTableData, DbQueryResult } from '../types.ts';
import { ConfirmModal } from './ConfirmModal.tsx';
import { formatINR } from '../lib/utils.ts';

interface AdminDatabaseExplorerProps {
  onUserDeleted?: () => void;
}

export function AdminDatabaseExplorer({ onUserDeleted }: AdminDatabaseExplorerProps) {
  const { getAuthHeaders, user: currentUser } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'tables' | 'sql' | 'purge'>('tables');
  const [selectedTable, setSelectedTable] = useState<string>('users');
  const [tableOverview, setTableOverview] = useState<DbTableInfo[]>([]);
  const [totalDbRecords, setTotalDbRecords] = useState<number>(0);
  const [tableData, setTableData] = useState<DbTableData | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(50);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Row Delete Modal
  const [deleteRowTarget, setDeleteRowTarget] = useState<{ table: string; id: any; idColumn?: string; label?: string } | null>(null);
  const [isDeletingRow, setIsDeletingRow] = useState(false);

  // User Edit Modal
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [editCalories, setEditCalories] = useState('2200');
  const [editProtein, setEditProtein] = useState('120');
  const [editAllowAdminView, setEditAllowAdminView] = useState(false);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Direct Hard Purge
  const [purgeIdentifier, setPurgeIdentifier] = useState('');
  const [isPurgingUser, setIsPurgingUser] = useState(false);
  const [confirmPurgeOpen, setConfirmPurgeOpen] = useState(false);

  // SQL Console
  const [sqlQuery, setSqlQuery] = useState(`SELECT u.id, u.name, u.email, u.role, u.status,\n       (SELECT COUNT(*) FROM food_entries fe WHERE fe.user_id = u.id) as meals_logged,\n       (SELECT COALESCE(SUM(amount), 0) FROM expenses ex WHERE ex.user_id = u.id) as total_spent\nFROM users u\nORDER BY u.created_at DESC;`);
  const [isExecutingSql, setIsExecutingSql] = useState(false);
  const [sqlResult, setSqlResult] = useState<DbQueryResult | null>(null);

  // 1. Load Database Overview (tables and counts)
  const loadDatabaseOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    try {
      const res = await fetch('/api/admin/database/overview', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.database?.tables) {
          setTableOverview(data.database.tables);
          setTotalDbRecords(data.database.totalRecords || 0);
        }
      }
    } catch (err) {
      console.error('Failed to load DB overview:', err);
    } finally {
      setIsLoadingOverview(false);
    }
  }, [getAuthHeaders]);

  // 2. Load Selected Table Data
  const loadTableData = useCallback(async (table: string, page: number = 1, search: string = '') => {
    setIsLoadingData(true);
    try {
      const queryParams = new URLSearchParams({
        table,
        page: page.toString(),
        limit: pageLimit.toString(),
        search,
      });
      const res = await fetch(`/api/admin/database/table-data?${queryParams.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setTableData(data);
      } else {
        toast.error('Failed to load table records.');
      }
    } catch (err) {
      console.error('Failed to load table data:', err);
      toast.error('Network error loading table data.');
    } finally {
      setIsLoadingData(false);
    }
  }, [getAuthHeaders, pageLimit, toast]);

  useEffect(() => {
    loadDatabaseOverview();
  }, [loadDatabaseOverview]);

  useEffect(() => {
    if (activeTab === 'tables') {
      loadTableData(selectedTable, currentPage, searchQuery);
    }
  }, [selectedTable, currentPage, activeTab, loadTableData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadTableData(selectedTable, 1, searchQuery);
  };

  // 3. Force Full Database Synchronization
  const handleSyncDatabase = async () => {
    setIsSyncing(true);
    const toastId = toast.loading('Resynchronizing PostgreSQL and Permanent Data Vaults...');
    try {
      const res = await fetch('/api/admin/database/sync-all', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Database fully synchronized & verified!', { id: toastId });
        await loadDatabaseOverview();
        await loadTableData(selectedTable, currentPage, searchQuery);
      } else {
        toast.error(data.error || 'Database sync failed.', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error during sync.', { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Export Complete Database Backup JSON
  const handleExportBackup = async () => {
    setIsExporting(true);
    const toastId = toast.loading('Generating complete database export snapshot...');
    try {
      const res = await fetch('/api/admin/database/export-all', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lifetracko_database_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Database backup downloaded successfully!', { id: toastId });
      } else {
        toast.error('Failed to export database backup.', { id: toastId });
      }
    } catch (err) {
      toast.error('Network error during export.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // 5. Delete Individual Database Row
  const confirmDeleteRow = async () => {
    if (!deleteRowTarget) return;
    setIsDeletingRow(true);
    const { table, id, idColumn = 'id' } = deleteRowTarget;
    const toastId = toast.loading(`Deleting row #${id} from ${table}...`);

    try {
      const res = await fetch('/api/admin/database/row', {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table,
          id,
          idColumn,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        toast.success(data.message || `Deleted record from ${table}.`, { id: toastId });
        setDeleteRowTarget(null);
        await loadDatabaseOverview();
        await loadTableData(table, currentPage, searchQuery);
        if (table === 'users' && onUserDeleted) {
          onUserDeleted();
        }
      } else {
        toast.error(data.error || 'Failed to delete record.', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error deleting record.', { id: toastId });
    } finally {
      setIsDeletingRow(false);
    }
  };

  // 6. Direct User Hard-Purge
  const handleDirectPurgeUser = async () => {
    if (!purgeIdentifier.trim()) {
      toast.error('Please enter a valid user ID or Email address.');
      return;
    }

    setIsPurgingUser(true);
    const toastId = toast.loading(`Executing absolute database purge for "${purgeIdentifier}"...`);

    try {
      const res = await fetch('/api/admin/database/purge-user', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: purgeIdentifier.trim(),
          email: purgeIdentifier.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        toast.success(data.message || `User and all database logs permanently deleted!`, { id: toastId });
        setPurgeIdentifier('');
        setConfirmPurgeOpen(false);
        await loadDatabaseOverview();
        await loadTableData(selectedTable, 1, '');
        if (onUserDeleted) {
          onUserDeleted();
        }
      } else {
        toast.error(data.error || data.details || 'Failed to purge user.', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error during user purge.', { id: toastId });
    } finally {
      setIsPurgingUser(false);
    }
  };

  // 7. Open User Edit Modal
  const handleOpenUserEdit = (userRow: any) => {
    setEditingUser(userRow);
    setEditName(userRow.name || '');
    setEditEmail(userRow.email || '');
    setEditRole(userRow.role || 'MEMBER');
    setEditStatus(userRow.status || 'ACTIVE');
    setEditCalories(String(userRow.dailyCaloriesGoal || userRow.daily_calories || 2200));
    setEditProtein(String(userRow.dailyProteinGoal || userRow.daily_protein || 120));
    setEditAllowAdminView(Boolean(userRow.allowAdminView ?? userRow.allow_admin_view));
    setEditNewPassword('');
  };

  // 8. Save User Edit to Database
  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSavingUser(true);
    const toastId = toast.loading(`Updating database record for ${editName}...`);

    try {
      const res = await fetch('/api/admin/database/update-user', {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: editingUser.id,
          name: editName.trim(),
          email: editEmail.trim(),
          role: editRole,
          status: editStatus,
          dailyCalories: parseInt(editCalories, 10) || 2200,
          dailyProtein: parseInt(editProtein, 10) || 120,
          allowAdminView: editAllowAdminView,
          newPassword: editNewPassword.trim() ? editNewPassword.trim() : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        toast.success(data.message || 'User profile updated in database!', { id: toastId });
        setEditingUser(null);
        await loadDatabaseOverview();
        await loadTableData('users', currentPage, searchQuery);
        if (onUserDeleted) onUserDeleted(); // Triggers reload on parent
      } else {
        toast.error(data.error || 'Failed to update user profile.', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error updating user.', { id: toastId });
    } finally {
      setIsSavingUser(false);
    }
  };

  // 9. Execute SQL in Console
  const handleExecuteSql = async () => {
    if (!sqlQuery.trim()) {
      toast.error('SQL query is required.');
      return;
    }

    setIsExecutingSql(true);
    setSqlResult(null);

    try {
      const res = await fetch('/api/admin/database/execute-sql', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sqlQuery.trim() }),
      });

      const data = await res.json();
      setSqlResult(data);

      if (res.ok && data.success) {
        toast.success(data.message || `Query executed successfully!`);
        await loadDatabaseOverview();
      } else {
        toast.error(data.error || 'SQL Query Execution Failed.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error executing SQL.');
      setSqlResult({
        success: false,
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        error: err?.message || 'Network Error',
      });
    } finally {
      setIsExecutingSql(false);
    }
  };

  const getTableIcon = (tableName: string) => {
    switch (tableName) {
      case 'users':
        return <Users className="w-4 h-4 text-emerald-500" />;
      case 'food_entries':
        return <Utensils className="w-4 h-4 text-amber-500" />;
      case 'expenses':
        return <Wallet className="w-4 h-4 text-indigo-500" />;
      case 'daily_nutrition':
        return <Flame className="w-4 h-4 text-rose-500" />;
      case 'daily_money':
        return <Layers className="w-4 h-4 text-teal-500" />;
      case 'body_weights':
        return <Scale className="w-4 h-4 text-cyan-500" />;
      case 'nutrition_goals':
        return <Dumbbell className="w-4 h-4 text-violet-500" />;
      case 'foods':
        return <Utensils className="w-4 h-4 text-emerald-400" />;
      case 'support_tickets':
        return <HelpCircle className="w-4 h-4 text-blue-500" />;
      case 'password_reset_tokens':
        return <Key className="w-4 h-4 text-orange-500" />;
      default:
        return <TableIcon className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Database Master Control Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Database Master Control & Explorer
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  FULL DB ACCESS
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                Direct administrative authority over all 10 relational tables, dedicated permanent auth vaults, user profiles, records, and SQL operations.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            <button
              onClick={handleSyncDatabase}
              disabled={isSyncing}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync & Verify DB'}
            </button>

            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {isExporting ? 'Exporting...' : 'Export JSON Backup'}
            </button>
          </div>
        </div>

        {/* Database Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Relational Tables</span>
            <span className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5 block">{tableOverview.length || 10} Tables</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Stored Records</span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">{totalDbRecords.toLocaleString()} Rows</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Database Storage</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block">PostgreSQL + Crash Vault</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Admin Privileges</span>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1 block">SUPERUSER CRUD + SQL</span>
          </div>
        </div>
      </div>

      {/* Main Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('tables')}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'tables'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <TableIcon className="w-4 h-4" /> Live Table Inspector
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'sql'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Terminal className="w-4 h-4" /> Interactive SQL Console
        </button>

        <button
          onClick={() => setActiveTab('purge')}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'purge'
              ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <UserX className="w-4 h-4 text-rose-500" /> Direct User Hard-Purge
        </button>
      </div>

      {/* VIEW 1: LIVE TABLE INSPECTOR */}
      {activeTab === 'tables' && (
        <div className="space-y-4">
          {/* Table Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {tableOverview.map((tbl) => (
              <button
                key={tbl.name}
                onClick={() => {
                  setSelectedTable(tbl.name);
                  setCurrentPage(1);
                  setSearchQuery('');
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all shrink-0 ${
                  selectedTable === tbl.name
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-500/50'
                }`}
              >
                {getTableIcon(tbl.name)}
                <span>{tbl.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    selectedTable === tbl.name
                      ? 'bg-white/20 dark:bg-black/20 text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {tbl.rowCount}
                </span>
              </button>
            ))}
          </div>

          {/* Table Content Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
            {/* Table Control Bar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 dark:text-white capitalize">
                  Table: <code className="text-emerald-600 dark:text-emerald-400 font-mono">{selectedTable}</code>
                </span>
                <span className="text-xs text-slate-400">
                  ({tableData?.totalCount || 0} total rows)
                </span>
              </div>

              {/* Search & Limit */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${selectedTable}...`}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </form>

                <select
                  value={pageLimit}
                  onChange={(e) => {
                    setPageLimit(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value="25">25 / page</option>
                  <option value="50">50 / page</option>
                  <option value="100">100 / page</option>
                </select>
              </div>
            </div>

            {/* Table Grid */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              {isLoadingData ? (
                <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                  Loading database records...
                </div>
              ) : !tableData || tableData.rows.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  No records found in <code className="font-mono text-emerald-500">{selectedTable}</code>.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/70 dark:bg-slate-800/80 sticky top-0 z-10 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Actions</th>
                      {tableData.columns.map((col) => (
                        <th key={col} className="py-2.5 px-3 font-mono whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                    {tableData.rows.map((row, idx) => {
                      const rowId = row.id !== undefined ? row.id : row.user_id || row.email || idx;
                      const isUserTable = selectedTable === 'users';
                      const isSelf = isUserTable && (row.id === currentUser?.id || row.email === currentUser?.email);

                      return (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2 px-3 whitespace-nowrap font-sans">
                            <div className="flex items-center gap-1.5">
                              {isUserTable && (
                                <button
                                  onClick={() => handleOpenUserEdit(row)}
                                  title="Edit User Database Record"
                                  className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {!isSelf && (
                                <button
                                  onClick={() =>
                                    setDeleteRowTarget({
                                      table: selectedTable,
                                      id: row.id !== undefined ? row.id : row.user_id || row.email,
                                      idColumn: row.id !== undefined ? 'id' : (row.user_id ? 'user_id' : 'email'),
                                      label: row.name || row.email || row.food_name || row.description || `Row #${rowId}`,
                                    })
                                  }
                                  title="Delete Record from Database"
                                  className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>

                          {tableData.columns.map((col) => {
                            const val = row[col];
                            let formattedVal = '';
                            if (val === null || val === undefined) {
                              formattedVal = 'NULL';
                            } else if (typeof val === 'object') {
                              formattedVal = JSON.stringify(val);
                            } else {
                              formattedVal = String(val);
                            }

                            return (
                              <td
                                key={col}
                                className="py-2 px-3 whitespace-nowrap max-w-xs truncate text-slate-700 dark:text-slate-300"
                                title={formattedVal}
                              >
                                {col === 'password_hash' ? (
                                  <span className="text-slate-400 select-none">••••••••••••••••</span>
                                ) : col === 'role' ? (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      val === 'ADMIN'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    }`}
                                  >
                                    {val}
                                  </span>
                                ) : col === 'status' ? (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      val === 'ACTIVE'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    }`}
                                  >
                                    {val}
                                  </span>
                                ) : val === null ? (
                                  <span className="text-slate-400 italic">null</span>
                                ) : (
                                  formattedVal
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            {tableData && tableData.totalPages > 1 && (
              <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-900/50">
                <span className="text-slate-500">
                  Showing page {tableData.page} of {tableData.totalPages} ({tableData.totalCount} records)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(tableData.totalPages, p + 1))}
                    disabled={currentPage >= tableData.totalPages}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: INTERACTIVE SQL CONSOLE */}
      {activeTab === 'sql' && (
        <div className="space-y-4">
          <div className="bg-slate-950 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-sm text-white">Admin SQL Query Engine</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Read/Write Enabled
                </span>
              </div>

              {/* Quick Preset Queries */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                <button
                  onClick={() =>
                    setSqlQuery('SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC LIMIT 20;')
                  }
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  List Users
                </button>
                <button
                  onClick={() =>
                    setSqlQuery('SELECT user_id, COUNT(*) as meals, SUM(calories) as total_cal FROM food_entries GROUP BY user_id;')
                  }
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Meal Totals
                </button>
                <button
                  onClick={() =>
                    setSqlQuery('SELECT user_id, COUNT(*) as expenses, SUM(amount) as total_spent FROM expenses GROUP BY user_id;')
                  }
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Expense Totals
                </button>
              </div>
            </div>

            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              rows={5}
              placeholder="Enter PostgreSQL query (e.g. SELECT * FROM users;)"
              className="w-full font-mono text-xs p-3 rounded-xl bg-slate-900 border border-slate-700 text-emerald-300 focus:outline-none focus:border-emerald-500"
            />

            <div className="flex items-center justify-between mt-3">
              <span className="text-[11px] text-slate-400">
                Execute SELECT, UPDATE, DELETE, or INSERT statements directly on PostgreSQL.
              </span>
              <button
                onClick={handleExecuteSql}
                disabled={isExecutingSql}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm shadow-emerald-600/30"
              >
                <Play className="w-3.5 h-3.5" />
                {isExecutingSql ? 'Executing...' : 'Run Query'}
              </button>
            </div>
          </div>

          {/* SQL Execution Output */}
          {sqlResult && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  {sqlResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  )}
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    {sqlResult.success
                      ? `Execution Result (${sqlResult.rowCount} rows in ${sqlResult.executionTimeMs}ms)`
                      : 'Execution Error'}
                  </span>
                </div>
              </div>

              {sqlResult.error ? (
                <div className="p-5 font-mono text-xs text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20">
                  {sqlResult.error}
                </div>
              ) : sqlResult.rows.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Query executed successfully. 0 rows returned.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      <tr>
                        {sqlResult.columns.map((c) => (
                          <th key={c} className="py-2 px-3 border-b border-slate-200 dark:border-slate-700">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                      {sqlResult.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          {sqlResult.columns.map((c) => (
                            <td key={c} className="py-1.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                              {r[c] === null ? (
                                <span className="text-slate-400 italic">null</span>
                              ) : typeof r[c] === 'object' ? (
                                JSON.stringify(r[c])
                              ) : (
                                String(r[c])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: DIRECT USER HARD-PURGE TOOL */}
      {activeTab === 'purge' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/70 flex items-center justify-center shrink-0">
              <UserX className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Direct User Hard-Purge Console
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Permanently purge any user profile and all their meals, expenses, daily logs, goals, and credentials from all database tables and permanent storage in one action.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300">
            <strong>Warning:</strong> Hard-purge is instantaneous and irreversible. All historical entries (diet, cash logs, weight logs, auth records) will be wiped immediately.
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <input
              type="text"
              value={purgeIdentifier}
              onChange={(e) => setPurgeIdentifier(e.target.value)}
              placeholder="Enter User Email Address or User ID (e.g. member@gmail.com or user_123)..."
              className="flex-1 px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />

            <button
              onClick={() => {
                if (!purgeIdentifier.trim()) {
                  toast.error('Please enter a user Email or ID to purge.');
                  return;
                }
                setConfirmPurgeOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shrink-0 shadow-sm shadow-rose-600/20"
            >
              <Trash2 className="w-4 h-4" /> Hard-Purge User Everywhere
            </button>
          </div>
        </div>
      )}

       {/* CONFIRM ROW DELETE MODAL */}
      <ConfirmModal
        isOpen={Boolean(deleteRowTarget)}
        title={`Delete Record from ${deleteRowTarget?.table || 'Database'}`}
        message={`Are you sure you want to delete this record (${deleteRowTarget?.label || deleteRowTarget?.id}) from ${deleteRowTarget?.table}? This action will permanently remove it from PostgreSQL.`}
        confirmLabel={isDeletingRow ? 'Deleting...' : 'Delete Record'}
        isDanger={true}
        isLoading={isDeletingRow}
        onConfirm={confirmDeleteRow}
        onCancel={() => setDeleteRowTarget(null)}
      />

      {/* CONFIRM HARD PURGE MODAL */}
      <ConfirmModal
        isOpen={confirmPurgeOpen}
        title="Confirm Hard Purge of User & All Data"
        message={`Are you absolutely sure you want to permanently purge user "${purgeIdentifier}"? This will immediately delete their account, meals, expenses, money ledgers, weight logs, and credentials from all database tables and permanent vaults.`}
        confirmLabel={isPurgingUser ? 'Purging Everything...' : 'Yes, Purge User & Data'}
        isDanger={true}
        isLoading={isPurgingUser}
        onConfirm={handleDirectPurgeUser}
        onCancel={() => setConfirmPurgeOpen(false)}
      />

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Edit User Database Record
                </h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="MEMBER">MEMBER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Daily Calorie Target (kcal)
                  </label>
                  <input
                    type="number"
                    value={editCalories}
                    onChange={(e) => setEditCalories(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Daily Protein Target (g)
                  </label>
                  <input
                    type="number"
                    value={editProtein}
                    onChange={(e) => setEditProtein(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editAllowAdminView}
                    onChange={(e) => setEditAllowAdminView(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Grant Admin Permission to View Personal Meal & Expense Logs
                  </span>
                </label>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Reset Password (Leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  placeholder="Enter new password (optional)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
                >
                  {isSavingUser ? 'Saving to Database...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
