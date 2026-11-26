import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
  AlertTriangle,
  CheckCircle,
  X,
  Stethoscope,
  Briefcase,
  User,
  Lock,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
import { usersApi } from '../api';
import { TableSkeleton } from '../../../components/skeletons';
import { DialogOverlay } from '../../../components/ui/DialogOverlay';
import { ServerTableFooter } from '../../../components/ui/ServerTableControls';

const ROLE_BADGE_MAP = {
  ADMIN: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/70',
  DENTIST: 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800/70',
  RECEPTIONIST: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70',
  PATIENT: 'bg-slate-50 dark:bg-gray-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-gray-600',
};

const STAFF_ROLE_CHOICES = [
  { value: 'RECEPTIONIST', label: 'Receptionist', subtitle: 'Front desk', icon: Briefcase },
  { value: 'DENTIST', label: 'Dentist', subtitle: 'Clinical', icon: Stethoscope },
  { value: 'ADMIN', label: 'Admin', subtitle: 'Full control', icon: ShieldCheck },
];

const ALL_ROLE_CHOICES = [
  { value: 'ADMIN', label: 'Admin', subtitle: 'Full system control', icon: ShieldCheck },
  { value: 'DENTIST', label: 'Dentist', subtitle: 'Clinical provider', icon: Stethoscope },
  { value: 'RECEPTIONIST', label: 'Receptionist', subtitle: 'Front desk triage', icon: Briefcase },
  { value: 'PATIENT', label: 'Patient', subtitle: 'Portal access only', icon: User },
];

function getInitials(firstName = '', lastName = '', fallbackEmail = '') {
  const f = String(firstName || '').trim().charAt(0);
  const l = String(lastName || '').trim().charAt(0);
  if (f || l) return (f + l).toUpperCase();
  return String(fallbackEmail || 'ST').trim().slice(0, 2).toUpperCase();
}

export function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ total: 0, total_records: 0, filtered_records: 0, page: 1, per_page: 10, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // Create Staff Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);
  const [staffForm, setStaffForm] = useState({
    email: '',
    password: '',
    role: 'RECEPTIONIST',
    first_name: '',
    last_name: '',
    phone: '',
    specialization: 'General Dentistry',
    license_number: '',
  });

  // Role Change Modal
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [updatingRole, setUpdatingRole] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, per_page: perPage };
      if (search.trim()) params.search = search.trim();
      if (roleFilter) params.role = roleFilter;
      if (statusFilter !== '') params.is_active = statusFilter;

      const res = await usersApi.getUsers(params);
      setUsers(res.data || []);
      setMeta(res.meta || { total: 0, total_records: 0, filtered_records: 0, page: 1, per_page: perPage, last_page: 1 });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load user directory.');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleToggleStatus = async (user) => {
    const nextState = !user.is_active;
    try {
      await usersApi.updateStatus(user.id, nextState);
      showToast(
        `${user.email} has been ${nextState ? 'activated' : 'deactivated'}.`,
        'success'
      );
      fetchUsers();
    } catch (err) {
      showToast(
        err.response?.data?.error?.message || 'Unable to change account status.',
        'error'
      );
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      await usersApi.createStaff(staffForm);
      showToast(`Staff account for ${staffForm.email} created successfully.`);
      setShowCreateModal(false);
      setShowStaffPassword(false);
      setStaffForm({
        email: '',
        password: '',
        role: 'RECEPTIONIST',
        first_name: '',
        last_name: '',
        phone: '',
        specialization: 'General Dentistry',
        license_number: '',
      });
      fetchUsers();
    } catch (err) {
      const apiDetails = err.response?.data?.error?.details;
      if (apiDetails && typeof apiDetails === 'object') {
        const firstMsg = Object.values(apiDetails)[0];
        setFormError(firstMsg || 'Validation failed.');
      } else {
        setFormError(err.response?.data?.error?.message || 'Failed to create account.');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!editingUser || !newRole) return;
    setUpdatingRole(true);
    try {
      await usersApi.updateRole(editingUser.id, newRole);
      showToast(`Role updated to ${newRole} for ${editingUser.email}.`);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to update user role.', 'error');
    } finally {
      setUpdatingRole(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">User & Account Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Provision staff accounts, inspect role assignments, and safeguard clinical access across the platform.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowStaffPassword(false);
            setFormError(null);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Provision Staff Account
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:bg-white dark:focus:bg-gray-700 transition-all"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
        >
          <option value="">All Roles</option>
          <option value="ADMIN">Administrators</option>
          <option value="DENTIST">Dentists</option>
          <option value="RECEPTIONIST">Receptionists</option>
          <option value="PATIENT">Patients</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
        >
          <option value="">All Statuses</option>
          <option value="1">Active Accounts</option>
          <option value="0">Disabled Accounts</option>
        </select>

        <button
          type="button"
          onClick={fetchUsers}
          className="p-2 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          title="Refresh User Directory"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600 dark:text-teal-400' : ''}`} />
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden">
        {error ? (
          <div className="p-10 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{error}</p>
            <button
              type="button"
              onClick={fetchUsers}
              className="px-4 py-2 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : loading && users.length === 0 ? (
          <TableSkeleton rows={6} cols={6} />
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No users matched your search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table role="table" className="tch-responsive-table w-full text-left border-collapse">
              <thead role="rowgroup">
                <tr role="row" className="bg-slate-50/80 dark:bg-gray-900/60 border-b border-slate-200 dark:border-gray-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th role="columnheader" className="py-3.5 px-5">User / Identity</th>
                  <th role="columnheader" className="py-3.5 px-4">Role</th>
                  <th role="columnheader" className="py-3.5 px-4">Account Status</th>
                  <th role="columnheader" className="py-3.5 px-4">Email Verified</th>
                  <th role="columnheader" className="py-3.5 px-4">Registered</th>
                  <th role="columnheader" className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/70 text-sm">
                {users.map((u) => (
                  <tr role="row" key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-700/40 transition-colors">
                    <td role="cell" data-label="User / Identity" className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200/60 dark:border-teal-800/70 flex items-center justify-center text-teal-700 dark:text-teal-300 font-bold text-xs shrink-0">
                          {u.display_name?.charAt(0)?.toUpperCase() || u.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{u.display_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td role="cell" data-label="Role" className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          ROLE_BADGE_MAP[u.role] || ROLE_BADGE_MAP.PATIENT
                        }`}
                      >
                        {u.role === 'ADMIN' && <ShieldCheck className="w-3 h-3" />}
                        {u.role === 'DENTIST' && <Stethoscope className="w-3 h-3" />}
                        {u.role === 'RECEPTIONIST' && <Briefcase className="w-3 h-3" />}
                        {u.role === 'PATIENT' && <User className="w-3 h-3" />}
                        {u.role}
                      </span>
                    </td>
                    <td role="cell" data-label="Account Status" className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-md ${
                          u.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.is_active ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-rose-500 dark:bg-rose-400'
                          }`}
                        />
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td role="cell" data-label="Email Verified" className="py-3.5 px-4">
                      <span
                        className={`text-xs font-medium ${
                          u.email_verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {u.email_verified ? 'Verified' : 'Pending Verification'}
                      </span>
                    </td>
                    <td role="cell" data-label="Registered" className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {u.created_at?.split(' ')[0]}
                    </td>
                    <td role="cell" data-label="Actions" className="py-3.5 px-5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUser(u);
                          setNewRole(u.role);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                      >
                        Change Role
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          u.is_active
                            ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/70'
                            : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70'
                        }`}
                      >
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Unified Server-Side Pagination */}
        {meta.total > 0 && (
          <ServerTableFooter
            page={meta.current_page || meta.page || page}
            perPage={meta.per_page || perPage}
            totalRecords={meta.total_records ?? meta.total ?? 0}
            filteredRecords={meta.filtered_records ?? meta.total ?? 0}
            totalPages={meta.total_pages || meta.last_page || 1}
            onPageChange={(nextPage) => setPage(nextPage)}
            onPerPageChange={(nextSize) => {
              setPerPage(nextSize);
              setPage(1);
            }}
            pageSizeOptions={[5, 10, 15, 25, 50]}
            loading={loading}
            itemLabel="accounts"
          />
        )}
      </div>

      {/* Create Staff Modal */}
      {showCreateModal && (() => {
        const pw = staffForm.password || '';
        const pwChecks = [
          { label: '8+ chars', ok: pw.length >= 8 },
          { label: 'Upper & lower', ok: /[A-Z]/.test(pw) && /[a-z]/.test(pw) },
          { label: 'Number', ok: /\d/.test(pw) },
          { label: 'Symbol', ok: /[^A-Za-z0-9]/.test(pw) },
        ];
        const previewName =
          `${staffForm.first_name.trim()} ${staffForm.last_name.trim()}`.trim() || 'New Staff Member';

        return (
          <DialogOverlay
            onClose={() => {
              setShowCreateModal(false);
              setShowStaffPassword(false);
            }}
            className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-2xl w-full max-w-lg overflow-hidden max-h-[90dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700/80 bg-slate-50/70 dark:bg-gray-900/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/90 dark:ring-teal-500/30 text-[#0F766E] dark:text-teal-300 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-50 truncate">
                      Provision Clinic Staff Account
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Create a verified staff account with role-based permissions
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowStaffPassword(false);
                  }}
                  aria-label="Close staff provisioning modal"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700/70 p-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStaff} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                  {formError && (
                    <div
                      role="alert"
                      className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-200 flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Live Staff Preview Strip */}
                  <div className="px-3.5 py-2.5 rounded-xl bg-slate-50/90 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-700/70 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/90 dark:ring-teal-500/30 text-[#0F766E] dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                        {getInitials(staffForm.first_name, staffForm.last_name, staffForm.email)}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {staffForm.role === 'DENTIST' && staffForm.first_name.trim() ? `Dr. ${previewName}` : previewName}
                        </span>
                        <span className="block text-[11px] text-slate-400 dark:text-slate-500 truncate">
                          {staffForm.email.trim() || 'staff@toothcare.com'}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border shrink-0 ${
                        ROLE_BADGE_MAP[staffForm.role] || ROLE_BADGE_MAP.PATIENT
                      }`}
                    >
                      {staffForm.role}
                    </span>
                  </div>

                  {/* Role Selector Cards */}
                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Staff Role <span className="text-rose-500 dark:text-rose-400">*</span>
                    </span>
                    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Select staff role">
                      {STAFF_ROLE_CHOICES.map(({ value, label, subtitle, icon: RoleIcon }) => {
                        const selected = staffForm.role === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setStaffForm({ ...staffForm, role: value })}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              selected
                                ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-500 dark:border-teal-400 ring-1 ring-teal-500/30'
                                : 'bg-white dark:bg-gray-900/60 border-slate-200 dark:border-gray-700 hover:border-teal-400 dark:hover:border-teal-500/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <RoleIcon
                                className={`w-4 h-4 ${
                                  selected
                                    ? 'text-[#0F766E] dark:text-teal-300'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                                aria-hidden="true"
                              />
                              {selected && <Check className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-300" aria-hidden="true" />}
                            </div>
                            <span
                              className={`block text-xs font-semibold mt-1.5 ${
                                selected
                                  ? 'text-[#0F766E] dark:text-teal-200'
                                  : 'text-slate-800 dark:text-slate-100'
                              }`}
                            >
                              {label}
                            </span>
                            <span className="block text-[10.5px] text-slate-400 dark:text-slate-500">
                              {subtitle}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Names */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="staff-first-name"
                        className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      >
                        First Name <span className="text-rose-500 dark:text-rose-400">*</span>
                      </label>
                      <input
                        id="staff-first-name"
                        required
                        type="text"
                        value={staffForm.first_name}
                        onChange={(e) => setStaffForm({ ...staffForm, first_name: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 outline-none transition-colors"
                        placeholder="e.g., Maria"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="staff-last-name"
                        className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      >
                        Last Name <span className="text-rose-500 dark:text-rose-400">*</span>
                      </label>
                      <input
                        id="staff-last-name"
                        required
                        type="text"
                        value={staffForm.last_name}
                        onChange={(e) => setStaffForm({ ...staffForm, last_name: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 outline-none transition-colors"
                        placeholder="e.g., Santos"
                      />
                    </div>
                  </div>

                  {/* Email & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="staff-email"
                        className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      >
                        Work Email <span className="text-rose-500 dark:text-rose-400">*</span>
                      </label>
                      <input
                        id="staff-email"
                        required
                        type="email"
                        value={staffForm.email}
                        onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 outline-none transition-colors"
                        placeholder="staff@toothcare.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="staff-phone"
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      >
                        <span>Contact Phone</span>
                        <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">
                          Optional
                        </span>
                      </label>
                      <input
                        id="staff-phone"
                        type="tel"
                        value={staffForm.phone}
                        onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-sm tabular-nums focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 outline-none transition-colors"
                        placeholder="+63 917 000 0000"
                      />
                    </div>
                  </div>

                  {/* Dentist Clinical Credentials (Conditional) */}
                  {staffForm.role === 'DENTIST' && (
                    <div className="p-3.5 bg-teal-50/55 dark:bg-teal-500/10 border border-teal-200/80 dark:border-teal-500/25 rounded-xl space-y-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                        <Stethoscope className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Dentist Credentials</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label
                            htmlFor="staff-specialization"
                            className="block text-[10.5px] font-semibold text-teal-900 dark:text-teal-200"
                          >
                            Specialization
                          </label>
                          <input
                            id="staff-specialization"
                            type="text"
                            value={staffForm.specialization}
                            onChange={(e) => setStaffForm({ ...staffForm, specialization: e.target.value })}
                            className="w-full px-3 py-2 border border-teal-200 dark:border-teal-500/35 rounded-xl text-xs bg-white dark:bg-gray-900/70 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor="staff-license"
                            className="block text-[10.5px] font-semibold text-teal-900 dark:text-teal-200"
                          >
                            PRC License #
                          </label>
                          <input
                            id="staff-license"
                            type="text"
                            value={staffForm.license_number}
                            onChange={(e) => setStaffForm({ ...staffForm, license_number: e.target.value })}
                            className="w-full px-3 py-2 border border-teal-200 dark:border-teal-500/35 rounded-xl text-xs font-mono tabular-nums bg-white dark:bg-gray-900/70 text-slate-800 dark:text-slate-100 placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] outline-none"
                            placeholder="e.g., PRC-123456"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Initial Temporary Password + Live Strength Pills */}
                  <div className="space-y-2">
                    <label
                      htmlFor="staff-password"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      Initial Temporary Password <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="staff-password"
                        required
                        type={showStaffPassword ? 'text' : 'password'}
                        value={staffForm.password}
                        onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                        className="w-full pl-3.5 pr-10 py-2.5 bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 outline-none transition-colors"
                        placeholder="Enter a strong temporary password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStaffPassword((prev) => !prev)}
                        aria-label={showStaffPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {pwChecks.map((rule) => (
                        <span
                          key={rule.label}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border transition-colors ${
                            rule.ok
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30'
                              : 'bg-slate-50 dark:bg-gray-900/60 text-slate-400 dark:text-slate-500 border-slate-200/80 dark:border-gray-700'
                          }`}
                        >
                          {rule.ok && <Check className="w-2.5 h-2.5" aria-hidden="true" />}
                          <span>{rule.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pinned Footer Actions */}
                <div className="px-6 py-3.5 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/60 dark:bg-gray-900/45 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowStaffPassword(false);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-gray-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {creating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>{creating ? 'Provisioning...' : 'Create Account'}</span>
                  </button>
                </div>
              </form>
            </div>
          </DialogOverlay>
        );
      })()}

      {/* Role Reassignment Modal */}
      {editingUser && (
        <DialogOverlay
          onClose={() => setEditingUser(null)}
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700/80 bg-slate-50/70 dark:bg-gray-900/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 ring-1 ring-inset ring-indigo-200/90 dark:ring-indigo-500/30 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-50 truncate">
                    Change User Role
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {editingUser.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                aria-label="Close role reassignment modal"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700/70 p-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRole}>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Assigned System Role
                  </span>
                  <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Select assigned role">
                    {ALL_ROLE_CHOICES.map(({ value, label, subtitle, icon: RoleIcon }) => {
                      const selected = newRole === value;
                      const isCurrent = editingUser.role === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setNewRole(value)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            selected
                              ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500/30'
                              : 'bg-white dark:bg-gray-900/60 border-slate-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <RoleIcon
                              className={`w-4 h-4 ${
                                selected
                                  ? 'text-indigo-600 dark:text-indigo-300'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                              aria-hidden="true"
                            />
                            {isCurrent && (
                              <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-slate-400">
                                Current
                              </span>
                            )}
                          </div>
                          <span
                            className={`block text-xs font-semibold mt-1.5 ${
                              selected
                                ? 'text-indigo-700 dark:text-indigo-200'
                                : 'text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            {label}
                          </span>
                          <span className="block text-[10.5px] text-slate-400 dark:text-slate-500">
                            {subtitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="px-6 py-3.5 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/60 dark:bg-gray-900/45 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-gray-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingRole || newRole === editingUser.role}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {updatingRole && <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  <span>{updatingRole ? 'Saving...' : 'Confirm Role Change'}</span>
                </button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}

export default UserManagementPage;
