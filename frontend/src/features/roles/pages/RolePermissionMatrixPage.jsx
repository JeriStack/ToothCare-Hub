import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Shield,
  ShieldCheck,
  Lock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Save,
  Info,
  Users
} from 'lucide-react';
import { rolesApi } from '../api';
import { PermissionMatrixSkeleton } from '../../../components/skeletons';

const PROTECTED_ADMIN_PERMISSIONS = [
  'users.view',
  'users.manage',
  'audit_logs.view',
  'settings.manage',
];

export function RolePermissionMatrixPage() {
  const [roles, setRoles] = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [matrixState, setMatrixState] = useState({});
  const [dirtyRoles, setDirtyRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

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

      const initialMatrix = {};
      rolesList.forEach((r) => {
        initialMatrix[r.id] = new Set(r.permissions || []);
      });
      setMatrixState(initialMatrix);
      setDirtyRoles({});
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load DRBAC permission matrix.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const handleTogglePermission = (role, slug) => {
    if (role.slug === 'admin' && PROTECTED_ADMIN_PERMISSIONS.includes(slug)) {
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

    setDirtyRoles((prev) => ({ ...prev, [role.id]: true }));
  };

  const handleSaveRole = async (role) => {
    setSavingRoleId(role.id);
    try {
      const slugs = Array.from(matrixState[role.id] || []);
      await rolesApi.syncRolePermissions(role.id, slugs);
      setDirtyRoles((prev) => ({ ...prev, [role.id]: false }));
      showToast(`Permissions updated for "${role.name}" role.`);
      fetchMatrix();
    } catch (err) {
      showToast(err.response?.data?.error?.message || `Failed to save ${role.name} permissions.`, 'error');
    } finally {
      setSavingRoleId(null);
    }
  };

  const moduleEntries = Object.entries(groupedPermissions);

  if (loading && roles.length === 0) {
    return <PermissionMatrixSkeleton />;
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 sm:max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
          <span className="tch-wrap-anywhere">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Dynamic Role-Based Access Control (DRBAC)</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure granular capability permissions per role in real time. Super-administrator safeguards prevent accidental lockout.
          </p>
        </div>
        <button
          onClick={fetchMatrix}
          disabled={loading}
          className="w-full sm:w-auto min-h-11 sm:min-h-10 inline-flex items-center justify-center gap-2 px-3.5 py-2 border border-slate-200 dark:border-gray-600 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-teal-600 dark:text-teal-400 ${loading ? 'animate-spin' : ''}`} />
          Reload Matrix
        </button>
      </div>

      {/* Roles Summary Strip */}
      <div className="portal-grid-4">
        {roles.map((r) => (
          <div
            key={r.id}
            className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm flex flex-col justify-between min-w-0"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 min-w-0 truncate">
                  {r.slug === 'admin' ? (
                    <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  ) : (
                    <Shield className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  )}
                  <span className="truncate">{r.name}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 shrink-0">
                  <Users className="w-3 h-3" />
                  {r.users_count || 0}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{r.description}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-gray-700 flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {matrixState[r.id]?.size || 0} grants
              </span>
              {dirtyRoles[r.id] && (
                <button
                  onClick={() => handleSaveRole(r)}
                  disabled={savingRoleId === r.id}
                  className="inline-flex items-center gap-1 min-h-9 px-3 py-1.5 bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingRoleId === r.id ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info Banner */}
      <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/70 rounded-xl flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
        <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <span>
          Permissions toggled below take effect immediately across backend authorization policies. Core permissions marked with{' '}
          <Lock className="w-3 h-3 inline text-indigo-600 dark:text-indigo-400" /> are protected on the Administrator role to prevent administrative lockout.
        </span>
      </div>

      {/* Matrix Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {error ? (
          <div className="p-10 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{error}</p>
            <button
              onClick={fetchMatrix}
              className="px-4 py-2 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg"
            >
              Retry
            </button>
          </div>
        ) : loading && roles.length === 0 ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-slate-100 dark:bg-gray-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tch-matrix-table w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-gray-900/60 border-b border-slate-200 dark:border-gray-700 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <th className="py-4 px-5 md:min-w-[230px] md:sticky md:left-0 bg-slate-50 dark:bg-gray-900/95 z-10">Capability / Permission</th>
                  {roles.map((role) => (
                    <th key={role.id} className="py-4 px-4 text-center md:min-w-[115px]">
                      <div className="flex flex-col items-center gap-1">
                        <span>{role.name}</span>
                        {dirtyRoles[role.id] && (
                          <button
                            onClick={() => handleSaveRole(role)}
                            disabled={savingRoleId === role.id}
                            className="text-[10px] px-2 py-0.5 bg-teal-600 dark:bg-[#0F766E] text-white rounded-md hover:bg-teal-700 dark:hover:bg-[#0D9488] font-medium"
                          >
                            {savingRoleId === role.id ? 'Saving...' : 'Save'}
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700/70 text-sm">
                {moduleEntries.map(([moduleName, perms]) => (
                  <React.Fragment key={moduleName}>
                    {/* Module Group Header Row */}
                    <tr className="tch-matrix-group-row bg-slate-50/70 dark:bg-gray-900/50">
                      <td
                        colSpan={roles.length + 1}
                        className="py-2.5 px-5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200"
                      >
                        Module: {moduleName}
                      </td>
                    </tr>
                    {perms.map((perm) => (
                      <tr key={perm.id} className="tch-matrix-row hover:bg-slate-50/50 dark:hover:bg-gray-700/40 transition-colors">
                        <td className="py-3 px-5 md:sticky md:left-0 bg-white dark:bg-gray-800 z-[1]">
                          <div className="font-medium text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                            <span>{perm.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 tch-wrap-anywhere">{perm.slug}</div>
                        </td>
                        {roles.map((role) => {
                          const isChecked = matrixState[role.id]?.has(perm.slug) || false;
                          const isProtected =
                            role.slug === 'admin' && PROTECTED_ADMIN_PERMISSIONS.includes(perm.slug);

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
                                className={`inline-flex items-center justify-center min-w-11 min-h-11 md:min-w-0 md:min-h-0 md:w-9 md:h-9 rounded-lg border transition-all shrink-0 ${
                                  isChecked
                                    ? isProtected
                                      ? 'bg-indigo-100 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 cursor-not-allowed'
                                      : 'bg-teal-600 dark:bg-[#0F766E] border-teal-600 dark:border-teal-500 text-white hover:bg-teal-700 dark:hover:bg-[#0D9488]'
                                    : 'bg-white dark:bg-gray-700 border-slate-300 dark:border-gray-600 text-slate-300 dark:text-slate-500 hover:border-slate-400 dark:hover:border-gray-500'
                                }`}
                              >
                                {isProtected ? (
                                  <Lock className="w-3.5 h-3.5" />
                                ) : isChecked ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  <span className="w-2 h-2 rounded-full bg-slate-200 dark:bg-gray-500" />
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default RolePermissionMatrixPage;
