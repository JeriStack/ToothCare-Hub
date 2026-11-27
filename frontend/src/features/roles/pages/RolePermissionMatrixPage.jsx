import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Key,
  Shield,
  ShieldCheck,
  Stethoscope,
  Briefcase,
  User,
  Lock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Save,
  Info,
  Users,
  Search,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  Sparkles,
  LayoutGrid,
  Calendar,
  ClipboardList,
  LayoutDashboard,
  Mail,
  FileText,
  BarChart3,
  Settings,
  Activity,
  Archive,
  History,
} from 'lucide-react';
import { rolesApi } from '../api';
import { PermissionMatrixSkeleton } from '../../../components/skeletons';
import { ServerTableFooter } from '../../../components/ui/ServerTableControls';

const DEFAULT_PROTECTED_ADMIN_PERMISSIONS = [
  'users.view',
  'users.manage',
  'roles.manage',
  'audit_logs.view',
  'settings.manage',
];

function getModuleIcon(modName = '') {
  switch (String(modName).toLowerCase()) {
    case 'appointments':
      return Calendar;
    case 'archives':
      return Archive;
    case 'clinical':
      return ClipboardList;
    case 'dashboard':
      return LayoutDashboard;
    case 'dentists':
      return Stethoscope;
    case 'email':
      return Mail;
    case 'history':
      return History;
    case 'legal':
      return FileText;
    case 'patients':
      return User;
    case 'reports':
      return BarChart3;
    case 'security':
      return Shield;
    case 'services':
      return Sparkles;
    case 'settings':
      return Settings;
    case 'system':
      return Activity;
    case 'users':
      return Users;
    default:
      return Key;
  }
}

function getRoleVisuals(slug = '') {
  switch (String(slug).toLowerCase()) {
    case 'admin':
      return {
        icon: ShieldCheck,
        badge: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-indigo-200/80 dark:ring-indigo-500/30',
        bar: 'bg-indigo-500 dark:bg-indigo-400',
        activeRing: 'border-indigo-400 dark:border-indigo-500/70 ring-1 ring-indigo-400/30',
      };
    case 'dentist':
      return {
        icon: Stethoscope,
        badge: 'bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 ring-teal-200/80 dark:ring-teal-500/30',
        bar: 'bg-teal-500 dark:bg-teal-400',
        activeRing: 'border-teal-400 dark:border-teal-500/70 ring-1 ring-teal-400/30',
      };
    case 'receptionist':
      return {
        icon: Briefcase,
        badge: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-200/80 dark:ring-amber-500/30',
        bar: 'bg-amber-500 dark:bg-amber-400',
        activeRing: 'border-amber-400 dark:border-amber-500/70 ring-1 ring-amber-400/30',
      };
    default:
      return {
        icon: User,
        badge: 'bg-slate-100 dark:bg-gray-700/80 text-slate-600 dark:text-slate-300 ring-slate-200/80 dark:ring-gray-600',
        bar: 'bg-sky-500 dark:bg-sky-400',
        activeRing: 'border-sky-400 dark:border-sky-500/70 ring-1 ring-sky-400/30',
      };
  }
}

function formatModuleLabel(raw = '') {
  return String(raw)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RolePermissionMatrixPage() {
  const [roles, setRoles] = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [protectedAdminPermissions, setProtectedAdminPermissions] = useState(
    DEFAULT_PROTECTED_ADMIN_PERMISSIONS
  );
  const [savedMatrix, setSavedMatrix] = useState({});
  const [matrixState, setMatrixState] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Interactive Filters & Matrix View Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [focusedRoleId, setFocusedRoleId] = useState(null);
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  const [collapsedModules, setCollapsedModules] = useState({});
  const [modulePage, setModulePage] = useState(1);
  const [modulesPerPage, setModulesPerPage] = useState(4);

  useEffect(() => {
    setModulePage(1);
  }, [searchQuery, selectedModule, showModifiedOnly]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesList, permData] = await Promise.all([
        rolesApi.getRoles(),
        rolesApi.getPermissions(),
      ]);

      setRoles(rolesList);
      setGroupedPermissions(permData.grouped || {});

      if (Array.isArray(permData.protected_admin_permissions) && permData.protected_admin_permissions.length > 0) {
        setProtectedAdminPermissions(permData.protected_admin_permissions);
      }

      const initialMatrix = {};
      const baselineMatrix = {};
      rolesList.forEach((r) => {
        initialMatrix[r.id] = new Set(r.permissions || []);
        baselineMatrix[r.id] = new Set(r.permissions || []);
      });
      setMatrixState(initialMatrix);
      setSavedMatrix(baselineMatrix);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load DRBAC permission matrix.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const protectedSet = useMemo(
    () => new Set(protectedAdminPermissions),
    [protectedAdminPermissions]
  );

  const isLockedForRole = useCallback(
    (role, slug) => role?.slug === 'admin' && protectedSet.has(slug),
    [protectedSet]
  );

  const allModuleEntries = useMemo(
    () => Object.entries(groupedPermissions),
    [groupedPermissions]
  );

  const totalPermissionCount = useMemo(
    () => allModuleEntries.reduce((acc, [, perms]) => acc + perms.length, 0),
    [allModuleEntries]
  );

  // Compute exact diff per role (added / removed / dirty) against savedMatrix
  const roleDiffs = useMemo(() => {
    const diffs = {};
    roles.forEach((role) => {
      const current = matrixState[role.id] || new Set();
      const baseline = savedMatrix[role.id] || new Set();
      const added = [];
      const removed = [];
      current.forEach((slug) => {
        if (!baseline.has(slug)) added.push(slug);
      });
      baseline.forEach((slug) => {
        if (!current.has(slug)) removed.push(slug);
      });
      diffs[role.id] = {
        added,
        removed,
        dirty: added.length > 0 || removed.length > 0,
      };
    });
    return diffs;
  }, [roles, matrixState, savedMatrix]);

  const dirtyRoleList = useMemo(
    () => roles.filter((r) => roleDiffs[r.id]?.dirty),
    [roles, roleDiffs]
  );

  const totalPendingChanges = useMemo(() => {
    let added = 0;
    let removed = 0;
    dirtyRoleList.forEach((r) => {
      added += roleDiffs[r.id]?.added.length || 0;
      removed += roleDiffs[r.id]?.removed.length || 0;
    });
    return { added, removed, total: added + removed };
  }, [dirtyRoleList, roleDiffs]);

  const isCellModified = useCallback(
    (roleId, slug) => {
      const curr = matrixState[roleId]?.has(slug) || false;
      const base = savedMatrix[roleId]?.has(slug) || false;
      return curr !== base;
    },
    [matrixState, savedMatrix]
  );

  const handleTogglePermission = (role, slug) => {
    if (isLockedForRole(role, slug)) {
      showToast(`Core permission "${slug}" is locked on Administrator to prevent lockout.`, 'error');
      return;
    }

    setMatrixState((prev) => {
      const next = { ...prev };
      const roleSet = new Set(next[role.id] || []);
      if (roleSet.has(slug)) {
        roleSet.delete(slug);
      } else {
        roleSet.add(slug);
      }
      next[role.id] = roleSet;
      return next;
    });
  };

  const handleToggleModuleForRole = (role, perms) => {
    const editableSlugs = perms
      .map((p) => p.slug)
      .filter((slug) => !isLockedForRole(role, slug));

    if (editableSlugs.length === 0) {
      showToast('All permissions in this module are locked for Administrator.', 'error');
      return;
    }

    setMatrixState((prev) => {
      const next = { ...prev };
      const roleSet = new Set(next[role.id] || []);
      const allGranted = editableSlugs.every((slug) => roleSet.has(slug));
      editableSlugs.forEach((slug) => {
        if (allGranted) {
          roleSet.delete(slug);
        } else {
          roleSet.add(slug);
        }
      });
      next[role.id] = roleSet;
      return next;
    });
  };

  const handleResetRole = (roleId) => {
    setMatrixState((prev) => ({
      ...prev,
      [roleId]: new Set(savedMatrix[roleId] || []),
    }));
  };

  const handleDiscardAll = () => {
    const reset = {};
    roles.forEach((r) => {
      reset[r.id] = new Set(savedMatrix[r.id] || []);
    });
    setMatrixState(reset);
    setShowModifiedOnly(false);
  };

  const notifyPermissionsUpdated = () => {
    try {
      window.dispatchEvent(new CustomEvent('toothcare:permissions-refresh'));
    } catch {
      // Ignore in non-browser environments
    }
  };

  const handleSaveRole = async (role) => {
    setSavingRoleId(role.id);
    const diff = roleDiffs[role.id] || { added: [], removed: [] };
    try {
      const slugs = Array.from(matrixState[role.id] || []);
      await rolesApi.syncRolePermissions(role.id, slugs);
      const summaryParts = [];
      if (diff.added.length > 0) summaryParts.push(`+${diff.added.length} granted`);
      if (diff.removed.length > 0) summaryParts.push(`-${diff.removed.length} revoked`);
      showToast(
        summaryParts.length > 0
          ? `Permissions updated for "${role.name}" (${summaryParts.join(', ')}).`
          : `Permissions updated for "${role.name}" role.`
      );
      notifyPermissionsUpdated();
      await fetchMatrix();
    } catch (err) {
      showToast(err.response?.data?.error?.message || `Failed to save ${role.name} permissions.`, 'error');
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleSaveAllDirty = async () => {
    if (dirtyRoleList.length === 0) return;
    setSavingAll(true);
    try {
      await Promise.all(
        dirtyRoleList.map((role) =>
          rolesApi.syncRolePermissions(role.id, Array.from(matrixState[role.id] || []))
        )
      );
      showToast(
        `Saved DRBAC permissions for ${dirtyRoleList.length} ${dirtyRoleList.length === 1 ? 'role' : 'roles'}.`
      );
      setShowModifiedOnly(false);
      notifyPermissionsUpdated();
      await fetchMatrix();
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to save all role permission changes.', 'error');
    } finally {
      setSavingAll(false);
    }
  };

  const visibleRoles = useMemo(() => {
    if (!focusedRoleId) return roles;
    const match = roles.filter((r) => r.id === focusedRoleId);
    return match.length > 0 ? match : roles;
  }, [roles, focusedRoleId]);

  const filteredModuleEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allModuleEntries
      .filter(([modName]) => selectedModule === 'ALL' || modName === selectedModule)
      .map(([modName, perms]) => {
        const filteredPerms = perms.filter((perm) => {
          if (showModifiedOnly) {
            const anyChanged = visibleRoles.some((r) => isCellModified(r.id, perm.slug));
            if (!anyChanged) return false;
          }
          if (!q) return true;
          return (
            String(perm.name || '').toLowerCase().includes(q) ||
            String(perm.slug || '').toLowerCase().includes(q) ||
            String(modName || '').toLowerCase().includes(q)
          );
        });
        return [modName, filteredPerms];
      })
      .filter(([, perms]) => perms.length > 0);
  }, [allModuleEntries, selectedModule, searchQuery, showModifiedOnly, visibleRoles, isCellModified]);

  const allCollapsed =
    filteredModuleEntries.length > 0 &&
    filteredModuleEntries.every(([modName]) => Boolean(collapsedModules[modName]));

  const toggleAllModules = () => {
    if (allCollapsed) {
      setCollapsedModules({});
    } else {
      const next = {};
      filteredModuleEntries.forEach(([modName]) => {
        next[modName] = true;
      });
      setCollapsedModules(next);
    }
  };

  const moduleTotalPages = Math.max(1, Math.ceil(filteredModuleEntries.length / modulesPerPage));
  const safeModulePage = Math.min(modulePage, moduleTotalPages);
  const paginatedModuleEntries = filteredModuleEntries.slice(
    (safeModulePage - 1) * modulesPerPage,
    safeModulePage * modulesPerPage
  );

  if (loading && roles.length === 0) {
    return <PermissionMatrixSkeleton />;
  }

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 sm:max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          )}
          <span className="tch-wrap-anywhere">{toast.message}</span>
        </div>
      )}

      {/* Executive Header */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-[#12304A] dark:text-slate-50 tracking-tight">
              Dynamic Role-Based Access Control (DRBAC)
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 border border-teal-200/80 dark:border-teal-500/30 tabular-nums">
              <Key className="w-3 h-3" aria-hidden="true" />
              {totalPermissionCount} capabilities
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Configure live capability grants per role. Saved changes enforce immediately on the backend and resync connected sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchMatrix}
          disabled={loading}
          className="w-full sm:w-auto min-h-10 inline-flex items-center justify-center gap-2 px-3.5 py-2 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-gray-800 hover:border-teal-400 dark:hover:border-teal-500 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-teal-600 dark:text-teal-400 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>Reload Matrix</span>
        </button>
      </div>

      {/* Role Summary Cards (Interactive Focus + Coverage Bar + Live Diff) */}
      <div className="portal-grid-4">
        {roles.map((r) => {
          const visuals = getRoleVisuals(r.slug);
          const RoleIcon = visuals.icon;
          const grantedCount = matrixState[r.id]?.size || 0;
          const pct = totalPermissionCount > 0 ? Math.round((grantedCount / totalPermissionCount) * 100) : 0;
          const diff = roleDiffs[r.id] || { added: [], removed: [], dirty: false };
          const isFocused = focusedRoleId === r.id;

          return (
            <div
              key={r.id}
              className={`bg-white dark:bg-gray-800/95 p-4 rounded-2xl border shadow-xs flex flex-col justify-between min-w-0 transition-all ${
                diff.dirty
                  ? 'border-amber-300 dark:border-amber-500/50 ring-1 ring-amber-300/40 dark:ring-amber-500/20'
                  : isFocused
                  ? visuals.activeRing
                  : 'border-slate-200/90 dark:border-gray-700/80 hover:border-slate-300 dark:hover:border-gray-600'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setFocusedRoleId((prev) => (prev === r.id ? null : r.id))}
                    title={isFocused ? 'Show all roles' : `Focus ${r.name} column`}
                    className="flex items-center gap-2.5 min-w-0 text-left group cursor-pointer"
                  >
                    <span className={`w-8 h-8 rounded-xl ring-1 ring-inset flex items-center justify-center shrink-0 ${visuals.badge}`}>
                      <RoleIcon className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <span className="block font-bold text-sm text-slate-900 dark:text-slate-50 truncate group-hover:text-[#0F766E] dark:group-hover:text-teal-300 transition-colors">
                        {r.name}
                      </span>
                      {isFocused && (
                        <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                          Focused · Click to reset
                        </span>
                      )}
                    </div>
                  </button>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-gray-900/70 text-slate-600 dark:text-slate-300 tabular-nums shrink-0"
                    title={`${r.users_count || 0} assigned accounts`}
                  >
                    <Users className="w-3 h-3" aria-hidden="true" />
                    {r.users_count || 0}
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed text-justify">
                  {r.description}
                </p>

                {/* Grant Coverage Progress Bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] tabular-nums">
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {grantedCount} / {totalPermissionCount} grants
                    </span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-gray-900 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${visuals.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-gray-700/70 flex items-center justify-between gap-2 min-h-[34px]">
                {diff.dirty ? (
                  <>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold tabular-nums">
                      {diff.added.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          +{diff.added.length}
                        </span>
                      )}
                      {diff.removed.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300">
                          -{diff.removed.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleResetRole(r.id)}
                        disabled={savingRoleId === r.id || savingAll}
                        title={`Discard changes for ${r.name}`}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-gray-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveRole(r)}
                        disabled={savingRoleId === r.id || savingAll}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{savingRoleId === r.id ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Synced with policy
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unsaved Changes Sticky Action Bar */}
      {dirtyRoleList.length > 0 && (
        <div
          role="region"
          aria-label="Unsaved permission changes"
          className="sticky top-3 z-20 p-3.5 rounded-2xl bg-amber-50/95 dark:bg-amber-950/90 border border-amber-300/90 dark:border-amber-600/60 shadow-md backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-100">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <span>
              <strong className="tabular-nums">{totalPendingChanges.total}</strong> unsaved{' '}
              {totalPendingChanges.total === 1 ? 'change' : 'changes'} across{' '}
              <strong className="tabular-nums">{dirtyRoleList.length}</strong>{' '}
              {dirtyRoleList.length === 1 ? 'role' : 'roles'}
              {totalPendingChanges.added > 0 ? ` (+${totalPendingChanges.added} granted)` : ''}
              {totalPendingChanges.removed > 0 ? ` (-${totalPendingChanges.removed} revoked)` : ''}.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDiscardAll}
              disabled={savingAll || savingRoleId !== null}
              className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-gray-900/60 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-100/70 dark:hover:bg-amber-900/50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Discard All
            </button>
            <button
              type="button"
              onClick={handleSaveAllDirty}
              disabled={savingAll || savingRoleId !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {savingAll ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{savingAll ? 'Saving All...' : 'Save All Changes'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Search, Module Filter & Safeguard Notice */}
      <div className="bg-white dark:bg-gray-800/95 p-4 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search permissions"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search capability name, slug (e.g. legal_documents.publish), or module..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear permission search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {dirtyRoleList.length > 0 && (
              <button
                type="button"
                aria-pressed={showModifiedOnly}
                onClick={() => setShowModifiedOnly((prev) => !prev)}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                  showModifiedOnly
                    ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-400 dark:border-amber-500 text-amber-800 dark:text-amber-200'
                    : 'bg-white dark:bg-gray-900/60 border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-amber-400'
                }`}
              >
                Modified Only ({totalPendingChanges.total})
              </button>
            )}
            {focusedRoleId && (
              <button
                type="button"
                onClick={() => setFocusedRoleId(null)}
                className="px-3 py-2 rounded-xl border border-teal-300 dark:border-teal-500/40 bg-teal-50/70 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-200 text-xs font-semibold cursor-pointer"
              >
                Show All Roles
              </button>
            )}
            <button
              type="button"
              onClick={toggleAllModules}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-gray-500 text-xs font-semibold transition-colors cursor-pointer"
            >
              {allCollapsed ? 'Expand All' : 'Collapse All'}
            </button>
          </div>
        </div>

        {/* Module Filter Cards */}
        {allModuleEntries.length > 1 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Filter by Module
              </span>
              {selectedModule !== 'ALL' ? (
                <button
                  type="button"
                  onClick={() => setSelectedModule('ALL')}
                  className="text-[11px] font-semibold text-[#0F766E] dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Reset module filter
                </button>
              ) : (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                  {allModuleEntries.length} modules · {totalPermissionCount} capabilities
                </span>
              )}
            </div>

            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2"
              role="group"
              aria-label="Filter by module"
            >
              <button
                type="button"
                aria-pressed={selectedModule === 'ALL'}
                onClick={() => setSelectedModule('ALL')}
                className={`group relative flex flex-col justify-between gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer min-w-0 ${
                  selectedModule === 'ALL'
                    ? 'bg-teal-50/90 dark:bg-teal-500/15 border-teal-400 dark:border-teal-500/70 ring-1 ring-teal-400/25 shadow-2xs'
                    : 'bg-slate-50/70 dark:bg-gray-900/55 border-slate-200/80 dark:border-gray-700/80 hover:border-teal-400/70 dark:hover:border-teal-500/50 hover:bg-white dark:hover:bg-gray-800/80'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      selectedModule === 'ALL'
                        ? 'bg-[#0D9488] text-white'
                        : 'bg-white dark:bg-gray-800 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-gray-700 group-hover:text-teal-600 dark:group-hover:text-teal-300'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                      selectedModule === 'ALL'
                        ? 'bg-teal-100/90 dark:bg-teal-500/25 text-[#0F766E] dark:text-teal-200'
                        : 'bg-slate-200/70 dark:bg-gray-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {totalPermissionCount}
                  </span>
                </div>
                <span
                  className={`text-xs font-semibold truncate ${
                    selectedModule === 'ALL'
                      ? 'text-[#0F766E] dark:text-teal-200'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  All Modules
                </span>
              </button>

              {allModuleEntries.map(([modName, perms]) => {
                const active = selectedModule === modName;
                const ModIcon = getModuleIcon(modName);
                const hasModifiedInMod = perms.some((perm) =>
                  visibleRoles.some((r) => isCellModified(r.id, perm.slug))
                );

                return (
                  <button
                    key={modName}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedModule(active ? 'ALL' : modName)}
                    className={`group relative flex flex-col justify-between gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer min-w-0 ${
                      active
                        ? 'bg-teal-50/90 dark:bg-teal-500/15 border-teal-400 dark:border-teal-500/70 ring-1 ring-teal-400/25 shadow-2xs'
                        : hasModifiedInMod
                        ? 'bg-amber-50/50 dark:bg-amber-500/10 border-amber-300/80 dark:border-amber-500/40 hover:border-teal-400/70'
                        : 'bg-slate-50/70 dark:bg-gray-900/55 border-slate-200/80 dark:border-gray-700/80 hover:border-teal-400/70 dark:hover:border-teal-500/50 hover:bg-white dark:hover:bg-gray-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          active
                            ? 'bg-[#0D9488] text-white'
                            : 'bg-white dark:bg-gray-800 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-gray-700 group-hover:text-teal-600 dark:group-hover:text-teal-300'
                        }`}
                      >
                        <ModIcon className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                      <div className="flex items-center gap-1">
                        {hasModifiedInMod && (
                          <span
                            className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                            title="Has unsaved changes"
                            aria-hidden="true"
                          />
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                            active
                              ? 'bg-teal-100/90 dark:bg-teal-500/25 text-[#0F766E] dark:text-teal-200'
                              : 'bg-slate-200/70 dark:bg-gray-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {perms.length}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold truncate ${
                        active
                          ? 'text-[#0F766E] dark:text-teal-200'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {formatModuleLabel(modName)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Lockout Safeguard Notice */}
        <div className="pt-2 border-t border-slate-100 dark:border-gray-700/70 flex items-center gap-2 text-[11.5px] text-slate-500 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" aria-hidden="true" />
          <span>
            Core Administrator permissions marked with{' '}
            <Lock className="w-3 h-3 inline text-indigo-500 dark:text-indigo-400" aria-hidden="true" /> are locked to prevent accidental lockout. Click a module count pill to bulk-toggle a module for any role.
          </span>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden">
        {error ? (
          <div className="p-10 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{error}</p>
            <button
              type="button"
              onClick={fetchMatrix}
              className="px-4 py-2 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : filteredModuleEntries.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Key className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              No matching capabilities found
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Adjust your search keyword or reset module filters to view all permissions.
            </p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="tch-matrix-table w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-gray-900/70 border-b border-slate-200 dark:border-gray-700 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <th className="py-3.5 px-5 md:min-w-[260px] md:sticky md:left-0 bg-slate-50 dark:bg-gray-900/95 z-10">
                    Capability / Permission
                  </th>
                  {visibleRoles.map((role) => {
                    const diff = roleDiffs[role.id];
                    return (
                      <th key={role.id} className="py-3.5 px-4 text-center md:min-w-[125px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-slate-800 dark:text-slate-100">{role.name}</span>
                          {diff?.dirty && (
                            <button
                              type="button"
                              onClick={() => handleSaveRole(role)}
                              disabled={savingRoleId === role.id || savingAll}
                              className="text-[10px] px-2.5 py-0.5 bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-md font-semibold cursor-pointer"
                            >
                              {savingRoleId === role.id ? 'Saving...' : 'Save'}
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700/70 text-sm">
                {paginatedModuleEntries.map(([moduleName, perms]) => {
                  const isCollapsed = Boolean(collapsedModules[moduleName]);
                  return (
                    <React.Fragment key={moduleName}>
                      {/* Module Group Header Row with Per-Role Bulk Toggle */}
                      <tr className="tch-matrix-group-row bg-slate-50/85 dark:bg-gray-900/60">
                        <td className="py-2.5 px-5 md:sticky md:left-0 bg-slate-50/95 dark:bg-gray-900/90 z-[2]">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedModules((prev) => ({
                                ...prev,
                                [moduleName]: !prev[moduleName],
                              }))
                            }
                            aria-expanded={!isCollapsed}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            )}
                            <span>Module: {moduleName}</span>
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                              ({perms.length})
                            </span>
                          </button>
                        </td>

                        {visibleRoles.map((role) => {
                          const grantedInMod = perms.filter((p) => matrixState[role.id]?.has(p.slug)).length;
                          const editableInMod = perms.filter((p) => !isLockedForRole(role, p.slug));
                          const allEditableGranted =
                            editableInMod.length > 0 &&
                            editableInMod.every((p) => matrixState[role.id]?.has(p.slug));
                          const allLocked = editableInMod.length === 0;

                          return (
                            <td key={`${moduleName}-${role.id}`} className="py-2 px-4 text-center">
                              <button
                                type="button"
                                disabled={allLocked}
                                onClick={() => handleToggleModuleForRole(role, perms)}
                                title={
                                  allLocked
                                    ? `All ${moduleName} permissions are locked for ${role.name}`
                                    : allEditableGranted
                                    ? `Revoke all ${moduleName} permissions for ${role.name}`
                                    : `Grant all ${moduleName} permissions for ${role.name}`
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold tabular-nums border transition-colors ${
                                  allLocked
                                    ? 'bg-indigo-50/70 dark:bg-indigo-500/10 border-indigo-200/80 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300 cursor-not-allowed'
                                    : grantedInMod === perms.length
                                    ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-300/80 dark:border-teal-500/35 text-[#0F766E] dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/25 cursor-pointer'
                                    : grantedInMod > 0
                                    ? 'bg-slate-100 dark:bg-gray-800 border-slate-300 dark:border-gray-600 text-slate-700 dark:text-slate-200 hover:border-teal-400 cursor-pointer'
                                    : 'bg-white dark:bg-gray-800/70 border-slate-200 dark:border-gray-700 text-slate-400 dark:text-slate-500 hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-300 cursor-pointer'
                                }`}
                              >
                                {allLocked && <Lock className="w-2.5 h-2.5" aria-hidden="true" />}
                                <span>
                                  {grantedInMod}/{perms.length}
                                </span>
                              </button>
                            </td>
                          );
                        })}
                      </tr>

                      {!isCollapsed &&
                        perms.map((perm) => (
                          <tr
                            key={perm.id}
                            className="tch-matrix-row hover:bg-slate-50/60 dark:hover:bg-gray-700/35 transition-colors"
                          >
                            <td className="py-3 px-5 md:sticky md:left-0 bg-white dark:bg-gray-800 z-[1]">
                              <div className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Key className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
                                <span>{perm.name}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 pl-5.5 tch-wrap-anywhere">
                                {perm.slug}
                              </div>
                            </td>

                            {visibleRoles.map((role) => {
                              const isChecked = matrixState[role.id]?.has(perm.slug) || false;
                              const isProtected = isLockedForRole(role, perm.slug);
                              const modified = isCellModified(role.id, perm.slug);

                              return (
                                <td key={`${role.id}-${perm.id}`} data-role={role.name} className="py-3 px-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePermission(role, perm.slug)}
                                    disabled={isProtected}
                                    aria-pressed={isChecked}
                                    aria-label={
                                      isProtected
                                        ? `${perm.name} locked for ${role.name}`
                                        : `${perm.name} for ${role.name}`
                                    }
                                    title={
                                      isProtected
                                        ? 'Protected super-admin permission'
                                        : `Toggle ${perm.slug} for ${role.name}`
                                    }
                                    className={`relative inline-flex items-center justify-center min-w-11 min-h-11 md:min-w-0 md:min-h-0 md:w-9 md:h-9 rounded-xl border transition-all shrink-0 ${
                                      isChecked
                                        ? isProtected
                                          ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 cursor-not-allowed'
                                          : 'bg-[#0D9488] dark:bg-[#0F766E] border-[#0D9488] dark:border-teal-500 text-white hover:bg-[#0F766E] dark:hover:bg-[#0D9488] shadow-2xs cursor-pointer'
                                        : 'bg-white dark:bg-gray-900/60 border-slate-200 dark:border-gray-700 text-slate-300 dark:text-slate-500 hover:border-teal-400 dark:hover:border-teal-500/60 cursor-pointer'
                                    } ${modified ? 'ring-2 ring-amber-400/80 ring-offset-1 dark:ring-offset-gray-800' : ''}`}
                                  >
                                    {isProtected ? (
                                      <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                                    ) : isChecked ? (
                                      <Check className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                                    ) : (
                                      <span className="w-2 h-2 rounded-full bg-slate-200 dark:bg-gray-600" />
                                    )}
                                    {modified && (
                                      <span
                                        className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white dark:border-gray-800"
                                        aria-hidden="true"
                                      />
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ServerTableFooter
            page={safeModulePage}
            perPage={modulesPerPage}
            totalRecords={Object.keys(groupedPermissions).length}
            filteredRecords={filteredModuleEntries.length}
            totalPages={moduleTotalPages}
            onPageChange={(nextPage) => setModulePage(nextPage)}
            onPerPageChange={(nextSize) => {
              setModulesPerPage(nextSize);
              setModulePage(1);
            }}
            pageSizeOptions={[2, 4, 6, 10]}
            loading={loading}
            itemLabel="modules"
          />
          </>
        )}
      </div>
    </div>
  );
}

export default RolePermissionMatrixPage;
