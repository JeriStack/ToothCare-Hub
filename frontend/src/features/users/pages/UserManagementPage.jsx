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
  Lock
} from 'lucide-react';
import { usersApi } from '../api';
import { TableSkeleton } from '../../../components/skeletons';

const ROLE_BADGE_MAP = {
  ADMIN: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/70',
  DENTIST: 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800/70',
  RECEPTIONIST: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70',
  PATIENT: 'bg-slate-50 dark:bg-gray-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-gray-600',
};

export function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 15, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Create Staff Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
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
      const params = { page, per_page: 15 };
      if (search.trim()) params.search = search.trim();
      if (roleFilter) params.role = roleFilter;
      if (statusFilter !== '') params.is_active = statusFilter;

      const res = await usersApi.getUsers(params);
      setUsers(res.data || []);
      setMeta(res.meta || { total: 0, page: 1, per_page: 15, last_page: 1 });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load user directory.');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

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
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
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
          onClick={fetchUsers}
          className="p-2 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
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
              onClick={fetchUsers}
              className="px-4 py-2 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg"
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
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-gray-900/60 border-b border-slate-200 dark:border-gray-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-5">User / Identity</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Account Status</th>
                  <th className="py-3.5 px-4">Email Verified</th>
                  <th className="py-3.5 px-4">Registered</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700/70 text-sm">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="py-3.5 px-5">
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
                    <td className="py-3.5 px-4">
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
                    <td className="py-3.5 px-4">
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
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-medium ${
                          u.email_verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {u.email_verified ? 'Verified' : 'Pending Verification'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {u.created_at?.split(' ')[0]}
                    </td>
                    <td className="py-3.5 px-5 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setNewRole(u.role);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Change Role
                      </button>
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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

        {/* Pagination */}
        {meta.last_page > 1 && (
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-gray-700 bg-slate-50/40 dark:bg-gray-900/50 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span>
              Showing page <strong className="text-slate-900 dark:text-slate-100">{meta.page}</strong> of <strong className="text-slate-900 dark:text-slate-100">{meta.last_page}</strong> ({meta.total} accounts)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              <button
                disabled={page >= meta.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Staff Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between bg-[#12304A] dark:bg-gray-900 text-white">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-base">Provision Clinic Staff Account</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 rounded-xl text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">First Name</label>
                  <input
                    required
                    type="text"
                    value={staffForm.first_name}
                    onChange={(e) => setStaffForm({ ...staffForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
                    placeholder="e.g. Maria"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Last Name</label>
                  <input
                    required
                    type="text"
                    value={staffForm.last_name}
                    onChange={(e) => setStaffForm({ ...staffForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
                    placeholder="e.g. Santos"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Work Email Address</label>
                <input
                  required
                  type="email"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
                  placeholder="staff@toothcare.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Staff Role</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
                  >
                    <option value="RECEPTIONIST">Receptionist (Front Desk)</option>
                    <option value="DENTIST">Licensed Dentist</option>
                    <option value="ADMIN">Clinic Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
                    placeholder="+63 917 000 0000"
                  />
                </div>
              </div>

              {staffForm.role === 'DENTIST' && (
                <div className="grid grid-cols-2 gap-4 p-3.5 bg-teal-50/50 dark:bg-teal-950/35 border border-teal-200/60 dark:border-teal-800/60 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-teal-900 dark:text-teal-200 mb-1">Specialization</label>
                    <input
                      type="text"
                      value={staffForm.specialization}
                      onChange={(e) => setStaffForm({ ...staffForm, specialization: e.target.value })}
                      className="w-full px-3 py-1.5 border border-teal-200 dark:border-teal-800/70 rounded-lg text-xs bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-teal-900 dark:text-teal-200 mb-1">PRC License #</label>
                    <input
                      type="text"
                      value={staffForm.license_number}
                      onChange={(e) => setStaffForm({ ...staffForm, license_number: e.target.value })}
                      className="w-full px-3 py-1.5 border border-teal-200 dark:border-teal-800/70 rounded-lg text-xs bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500 outline-none"
                      placeholder="PRC-123456"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Initial Temporary Password</label>
                <input
                  required
                  type="password"
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
                  placeholder="Min 8 chars, upper, lower, digit, symbol"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {creating ? 'Provisioning...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Reassignment Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between bg-slate-50 dark:bg-gray-900/60">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Change User Role</h3>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateRole} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-gray-900/50 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                Reassigning system role for <strong className="text-slate-900 dark:text-slate-100">{editingUser.email}</strong>.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Assigned Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
                >
                  <option value="ADMIN">ADMIN (Full Control)</option>
                  <option value="DENTIST">DENTIST (Clinical Provider)</option>
                  <option value="RECEPTIONIST">RECEPTIONIST (Front Desk)</option>
                  <option value="PATIENT">PATIENT (Portal Access)</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingRole}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {updatingRole ? 'Saving...' : 'Confirm Role Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagementPage;
