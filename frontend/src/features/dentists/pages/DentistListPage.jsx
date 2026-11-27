import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Stethoscope,
  Edit2,
  Power,
  RefreshCw,
  X,
  Phone,
  Mail,
  ShieldCheck,
  UserCheck,
  Eye,
  EyeOff,
  Lock,
  Copy,
  Check,
  FileText,
  ChevronDown,
  History
} from 'lucide-react';
import { dentistsApi } from '../api';
import { RecordHistoryModal } from '../../history/components/RecordHistoryModal';
import { useAuth } from '../../auth';
import { TableSkeleton } from '../../../components/skeletons/TableSkeleton';
import { MobileSortControl } from '../../../components/ui/MobileSortControl';
import { ServerTableFooter } from '../../../components/ui/ServerTableControls';

import { DialogOverlay } from '../../../components/ui/DialogOverlay';
const SPECIALIZATION_OPTIONS = [
  'General Dentistry',
  'General & Cosmetic Dentistry',
  'Orthodontics',
  'Endodontics',
  'Endodontics & Micro-Dentistry',
  'Periodontics',
  'Pediatric Dentistry',
  'Prosthodontics',
  'Oral & Maxillofacial Surgery',
  'Cosmetic Dentistry',
];

const OPERATORY_CHAIR_OPTIONS = [
  'Operatory Chair 1',
  'Operatory Chair 2',
  'Operatory Chair 3',
  'Operatory Chair 4',
  'Surgical Suite',
];

function getDentistInitials(firstName = '', lastName = '') {
  const first = (firstName || '').trim().charAt(0);
  const last = (lastName || '').trim().charAt(0);
  return (first + last).toUpperCase() || 'DR';
}

function getSpecializationBadgeClasses(specialization = '') {
  const value = specialization.toLowerCase();
  if (value.includes('endodont') || value.includes('periodont')) {
    return 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/25';
  }
  if (value.includes('orthodont') || value.includes('restorative')) {
    return 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-500/25';
  }
  if (value.includes('surgery') || value.includes('oral')) {
    return 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/25';
  }
  if (value.includes('pediatric')) {
    return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/25';
  }
  if (value.includes('prosthodont')) {
    return 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-500/25';
  }
  return 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200/80 dark:border-teal-500/25';
}

export function DentistListPage() {
  const { user, hasPermission } = useAuth();
  const canManageDentists = Boolean(
    (typeof hasPermission === 'function' && hasPermission('dentists.manage')) || user?.role === 'ADMIN'
  );

  const [dentists, setDentists] = useState([]);
  const [viewingDentist, setViewingDentist] = useState(null);
  const [historyDentist, setHistoryDentist] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  const handleCopyContact = async (field, value) => {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(String(value));
      setCopiedField(field);
      setTimeout(() => {
        setCopiedField((prev) => (prev === field ? null : prev));
      }, 1600);
    } catch {
      // Clipboard API unavailable in non-secure context
    }
  };
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 10, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('ASC');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDentist, setEditingDentist] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    license_number: '',
    specialization: 'General Dentistry',
    phone: '',
    default_operatory_chair: 'Operatory Chair 1',
    bio: '',
    is_active: 1,
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Status Change Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    dentist: null,
    targetStatus: 0,
    submitting: false,
  });

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDentists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        per_page: perPage,
        sort_by: sortBy,
        sort_dir: sortDir,
      };
      if (search.trim()) params.search = search.trim();
      if (specializationFilter) params.specialization = specializationFilter;
      if (statusFilter !== '') params.is_active = statusFilter;

      const res = await dentistsApi.getAdminDentists(params);
      setDentists(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Error fetching dentists:', err);
      setError(err.response?.data?.error?.message || 'Failed to load clinic dentist roster.');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, sortBy, sortDir, search, specializationFilter, statusFilter]);

  useEffect(() => {
    fetchDentists();
  }, [fetchDentists]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortDir('ASC');
    }
    setPage(1);
  };

  const openCreateModal = () => {
    if (!canManageDentists) return;
    setEditingDentist(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      license_number: '',
      specialization: 'General Dentistry',
      phone: '',
      default_operatory_chair: 'Operatory Chair 1',
      bio: '',
      is_active: 1,
    });
    setFormErrors({});
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (dentist) => {
    if (!canManageDentists) return;
    setEditingDentist(dentist);
    setFormData({
      first_name: dentist.first_name,
      last_name: dentist.last_name,
      email: dentist.email || '',
      password: '',
      license_number: dentist.license_number,
      specialization: dentist.specialization,
      phone: dentist.phone,
      default_operatory_chair: dentist.default_operatory_chair || 'Chair 1',
      bio: dentist.bio || '',
      is_active: dentist.is_active ? 1 : 0,
    });
    setFormErrors({});
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.first_name.trim()) errs.first_name = 'First name is required.';
    if (!formData.last_name.trim()) errs.last_name = 'Last name is required.';
    if (!formData.phone.trim()) errs.phone = 'Phone number is required.';

    if (!editingDentist) {
      if (!formData.email.trim()) {
        errs.email = 'Email address is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        errs.email = 'Invalid email address format.';
      }

      if (!formData.password) {
        errs.password = 'Password is required.';
      } else if (formData.password.length < 8) {
        errs.password = 'Password must be at least 8 characters long.';
      }

      if (!formData.license_number.trim()) {
        errs.license_number = 'PRC license number is required.';
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setFormSubmitting(true);
    try {
      if (editingDentist) {
        const payload = {
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          specialization: formData.specialization,
          phone: formData.phone.trim(),
          default_operatory_chair: formData.default_operatory_chair,
          bio: formData.bio.trim() || null,
        };
        await dentistsApi.updateDentist(editingDentist.id, payload);
        showToast(`Dr. ${payload.first_name} ${payload.last_name} updated successfully.`);
      } else {
        const payload = {
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          license_number: formData.license_number.trim(),
          specialization: formData.specialization,
          phone: formData.phone.trim(),
          default_operatory_chair: formData.default_operatory_chair,
          bio: formData.bio.trim() || null,
          is_active: formData.is_active ? 1 : 0,
        };
        await dentistsApi.createDentist(payload);
        showToast(`Dr. ${payload.first_name} ${payload.last_name} registered successfully.`);
      }

      setIsModalOpen(false);
      fetchDentists();
    } catch (err) {
      const apiErrors = err.response?.data?.error?.details;
      if (apiErrors && typeof apiErrors === 'object') {
        setFormErrors(apiErrors);
      } else {
        setFormErrors({ general: err.response?.data?.error?.message || 'Operation failed.' });
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleStatusToggleClick = (dentist) => {
    if (!canManageDentists) return;
    const targetStatus = dentist.is_active ? 0 : 1;
    setConfirmModal({
      isOpen: true,
      dentist,
      targetStatus,
      submitting: false,
    });
  };

  const handleConfirmStatusChange = async () => {
    const { dentist, targetStatus } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, submitting: true }));

    try {
      await dentistsApi.toggleDentistStatus(dentist.id, targetStatus === 1);
      showToast(
        `Dr. ${dentist.first_name} ${dentist.last_name} ${
          targetStatus === 1 ? 'activated' : 'deactivated'
        } successfully.`
      );
      setConfirmModal({ isOpen: false, dentist: null, targetStatus: 0, submitting: false });
      fetchDentists();
    } catch (err) {
      console.error('Failed to update dentist status:', err);
      showToast(err.response?.data?.error?.message || 'Failed to update dentist status.', 'error');
      setConfirmModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 sm:max-w-sm z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm text-white ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">Clinic Dentist Roster</h1>
            {!canManageDentists && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-gray-700">
                <Lock className="w-3 h-3" aria-hidden="true" />
                View-Only Access
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {canManageDentists
              ? 'Manage licensed dental practitioners, PRC credentials, assigned operatories, and active practice schedules.'
              : 'View licensed dental practitioners, PRC credentials, assigned operatories, and account details.'}
          </p>
        </div>
        {canManageDentists && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 dark:bg-[#0F766E] hover:bg-teal-700 dark:hover:bg-teal-600 text-white font-medium text-sm rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Licensed Dentist
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4 transition-colors">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search name, license, or phone"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full min-h-11 sm:min-h-0 pl-9 pr-4 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={specializationFilter}
            onChange={(e) => {
              setSpecializationFilter(e.target.value);
              setPage(1);
            }}
            className="flex-1 sm:flex-none min-w-[9rem] min-h-11 sm:min-h-0 px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-base sm:text-sm bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:outline-none"
          >
            <option value="">All Specialties</option>
            {SPECIALIZATION_OPTIONS.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="flex-1 sm:flex-none min-w-[9rem] min-h-11 sm:min-h-0 px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-base sm:text-sm bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="1">Active Practice</option>
            <option value="0">Inactive / On Leave</option>
          </select>

          <button
            onClick={fetchDentists}
            title="Refresh Roster" aria-label="Refresh roster"
            className="inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 p-2 border border-slate-300 dark:border-gray-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table / State Views */}
      {loading && dentists.length === 0 ? (
        <TableSkeleton
          rows={6}
          columns={['w-12', 'w-48', 'w-36', 'w-28', 'w-24', 'w-24', 'w-28']}
        />
      ) : (
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden transition-colors">
        {error ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto mb-3" />
            <p className="text-slate-800 dark:text-slate-100 font-medium">{error}</p>
            <button
              type="button"
              onClick={fetchDentists}
              className="mt-4 px-4 py-2 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : dentists.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-700 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
              <Stethoscope className="w-5 h-5" />
            </div>
            <h3 className="text-slate-800 dark:text-slate-100 font-semibold">No dental practitioners found</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {search || specializationFilter || statusFilter !== ''
                ? 'Try adjusting your search criteria or filters.'
                : 'Get started by adding your clinic’s first practitioner.'}
            </p>
          </div>
        ) : (
          <>
          <MobileSortControl sortBy={sortBy} sortDir={sortDir} onSort={handleSort} options={[{ value: 'name', label: 'Practitioner name' }, { value: 'specialization', label: 'Specialization' }, { value: 'license_number', label: 'PRC license' }, { value: 'is_active', label: 'Status' }, { value: 'id', label: 'ID' }]} />
          <div className="overflow-x-auto">
            <table role="table" className="tch-responsive-table w-full text-left border-collapse">
              <thead role="rowgroup">
                <tr role="row" className="bg-slate-50/75 dark:bg-gray-900/45 border-b border-slate-100 dark:border-gray-700/80 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'id' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('id')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('id'); } }}>
                    <div className="flex items-center gap-1.5">
                      ID
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'id' ? 'text-[#0D9488] dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'name' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('name')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('name'); } }}>
                    <div className="flex items-center gap-1.5">
                      Practitioner
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'name' ? 'text-[#0D9488] dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'specialization' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('specialization')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('specialization'); } }}>
                    <div className="flex items-center gap-1.5">
                      Specialization
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'specialization' ? 'text-[#0D9488] dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'license_number' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('license_number')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('license_number'); } }}>
                    <div className="flex items-center gap-1.5">
                      PRC License
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'license_number' ? 'text-[#0D9488] dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    </div>
                  </th>
                  <th role="columnheader" className="py-3.5 px-4">Operatory</th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'is_active' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('is_active')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('is_active'); } }}>
                    <div className="flex items-center gap-1.5">
                      Status
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'is_active' ? 'text-[#0D9488] dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    </div>
                  </th>
                  <th role="columnheader" className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/70 text-sm">
                {dentists.map((dentist) => (
                  <tr role="row" key={dentist.id} className="hover:bg-slate-50/75 dark:hover:bg-gray-700/30 transition-colors">
                    <td role="cell" data-label="ID" className="py-3.5 px-5 font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                      #{dentist.id}
                    </td>
                    <td role="cell" data-label="Practitioner" className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-500/10 border border-teal-200/80 dark:border-teal-500/25 text-[#0F766E] dark:text-teal-300 flex items-center justify-center text-[11px] font-semibold shrink-0">
                          {getDentistInitials(dentist.first_name, dentist.last_name)}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-slate-50">
                          Dr. {dentist.first_name} {dentist.last_name}
                        </span>
                      </div>
                    </td>
                    <td role="cell" data-label="Specialization" className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getSpecializationBadgeClasses(dentist.specialization)}`}>
                        {dentist.specialization}
                      </span>
                    </td>
                    <td role="cell" data-label="PRC License" className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
                        {dentist.license_number}
                      </span>
                    </td>
                    <td role="cell" data-label="Operatory" className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100/90 dark:bg-gray-900/60 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-gray-700">
                        {dentist.default_operatory_chair || 'Chair 1'}
                      </span>
                    </td>
                    <td role="cell" data-label="Status" className="py-3.5 px-4">
                      {dentist.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden="true" />
                          Active Practice
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-gray-700/70 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" aria-hidden="true" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td role="cell" data-label="Actions" className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingDentist(dentist)}
                          className="w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-slate-600 dark:text-slate-300 hover:text-[#0F766E] dark:hover:text-teal-300 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-950/30 inline-flex items-center justify-center transition-colors cursor-pointer"
                          title="View Dentist Details"
                          aria-label={`View Dr. ${dentist.first_name} ${dentist.last_name}`}
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryDentist(dentist)}
                          className="w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 inline-flex items-center justify-center transition-colors cursor-pointer"
                          title="View Dentist History Timeline"
                          aria-label={`History for Dr. ${dentist.first_name} ${dentist.last_name}`}
                        >
                          <History className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        {canManageDentists && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(dentist)}
                              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-slate-600 dark:text-slate-300 hover:text-[#0F766E] dark:hover:text-teal-300 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-950/30 inline-flex items-center justify-center transition-colors cursor-pointer"
                              title="Edit Profile"
                              aria-label={`Edit Dr. ${dentist.first_name} ${dentist.last_name}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusToggleClick(dentist)}
                              className={`w-8 h-8 rounded-lg border inline-flex items-center justify-center transition-colors cursor-pointer ${
                                dentist.is_active
                                  ? 'border-rose-200/80 dark:border-rose-800/70 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                                  : 'border-emerald-200/80 dark:border-emerald-800/70 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                              }`}
                              title={dentist.is_active ? 'Deactivate Dentist' : 'Activate Dentist'}
                              aria-label={`${dentist.is_active ? 'Deactivate' : 'Activate'} Dr. ${dentist.first_name} ${dentist.last_name}`}
                            >
                              <Power className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
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
            itemLabel="dentists"
          />
        )}
      </div>
      )}

      {/* Dentist Modal (Create / Edit) */}
      {isModalOpen && (() => {
        const specializationChoices =
          formData.specialization && !SPECIALIZATION_OPTIONS.includes(formData.specialization)
            ? [formData.specialization, ...SPECIALIZATION_OPTIONS]
            : SPECIALIZATION_OPTIONS;
        const chairChoices =
          formData.default_operatory_chair && !OPERATORY_CHAIR_OPTIONS.includes(formData.default_operatory_chair)
            ? [formData.default_operatory_chair, ...OPERATORY_CHAIR_OPTIONS]
            : OPERATORY_CHAIR_OPTIONS;
        const bioLength = (formData.bio || '').length;

        return (
          <DialogOverlay
            onClose={() => setIsModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-gray-700/80 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90dvh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-gray-700/80 bg-slate-50/70 dark:bg-gray-900/50">
                <div className="flex items-center gap-3.5 min-w-0">
                  {editingDentist ? (
                    editingDentist.avatar_url ? (
                      <img
                        src={editingDentist.avatar_url}
                        alt={`Dr. ${editingDentist.first_name} ${editingDentist.last_name}`}
                        className="w-11 h-11 rounded-full object-cover border border-teal-200 dark:border-teal-500/35 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/90 dark:ring-teal-500/30 text-[#0F766E] dark:text-teal-300 flex items-center justify-center font-bold text-sm shrink-0">
                        {getDentistInitials(editingDentist.first_name, editingDentist.last_name)}
                      </div>
                    )
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/90 dark:ring-teal-500/30 text-[#0F766E] dark:text-teal-300 flex items-center justify-center shrink-0">
                      <Stethoscope className="w-5 h-5" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                        {editingDentist ? 'Edit Dentist Profile' : 'Register Licensed Dentist'}
                      </h2>
                      {editingDentist && (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                            editingDentist.is_active
                              ? 'bg-emerald-50 dark:bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30'
                              : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-600'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${editingDentist.is_active ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400'}`}
                            aria-hidden="true"
                          />
                          {editingDentist.is_active ? 'Active Practice' : 'Inactive'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {editingDentist
                        ? `Dentist #${editingDentist.id} · Update clinical credentials, chair assignment, and bio`
                        : 'Create a licensed dentist account and configure clinic assignment'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Close dentist form"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700/70 rounded-xl p-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                  {formErrors.general && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200 text-xs font-medium rounded-xl"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{formErrors.general}</span>
                    </div>
                  )}

                  {/* Live Compact Dentist Preview Strip */}
                  <div className="px-3.5 py-2.5 rounded-xl bg-slate-50/90 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-700/70 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/90 dark:ring-teal-500/30 text-[#0F766E] dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                        {getDentistInitials(formData.first_name, formData.last_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              formData.is_active === 1 ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                            Dr. {formData.first_name.trim() || 'First'} {formData.last_name.trim() || 'Last'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getSpecializationBadgeClasses(formData.specialization)}`}
                          >
                            {formData.specialization || 'General Dentistry'}
                          </span>
                          <span className="text-[10.5px] text-slate-400 dark:text-slate-500 truncate">
                            · {formData.default_operatory_chair || 'Operatory Chair 1'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0 hidden sm:inline">
                      {formData.license_number.trim() || 'PRC-PENDING'}
                    </span>
                  </div>

                  {/* Identity & Credentials */}
                  <div className="space-y-3.5">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Identity &amp; Credentials
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="dentist-first-name"
                          className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          First Name <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <input
                          id="dentist-first-name"
                          type="text"
                          required
                          placeholder="e.g., Maria"
                          value={formData.first_name}
                          onChange={(e) => {
                            setFormData({ ...formData, first_name: e.target.value });
                            if (formErrors.first_name) setFormErrors((prev) => ({ ...prev, first_name: undefined }));
                          }}
                          className={`w-full px-3.5 py-2.5 border rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 focus:outline-none transition-colors ${
                            formErrors.first_name
                              ? 'border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/30'
                              : 'border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/70'
                          }`}
                        />
                        {formErrors.first_name && (
                          <p className="text-xs text-rose-600 dark:text-rose-400">{formErrors.first_name}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="dentist-last-name"
                          className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          Last Name <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <input
                          id="dentist-last-name"
                          type="text"
                          required
                          placeholder="e.g., Santos"
                          value={formData.last_name}
                          onChange={(e) => {
                            setFormData({ ...formData, last_name: e.target.value });
                            if (formErrors.last_name) setFormErrors((prev) => ({ ...prev, last_name: undefined }));
                          }}
                          className={`w-full px-3.5 py-2.5 border rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 focus:outline-none transition-colors ${
                            formErrors.last_name
                              ? 'border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/30'
                              : 'border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/70'
                          }`}
                        />
                        {formErrors.last_name && (
                          <p className="text-xs text-rose-600 dark:text-rose-400">{formErrors.last_name}</p>
                        )}
                      </div>
                    </div>

                    {/* Credentials / Auth (Only for new dentist) */}
                    {!editingDentist && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label
                            htmlFor="dentist-email"
                            className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                          >
                            Account Email <span className="text-rose-500 dark:text-rose-400">*</span>
                          </label>
                          <input
                            id="dentist-email"
                            type="email"
                            required
                            placeholder="dr.santos@toothcare.com"
                            value={formData.email}
                            onChange={(e) => {
                              setFormData({ ...formData, email: e.target.value });
                              if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
                            }}
                            className={`w-full px-3.5 py-2.5 border rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 focus:outline-none transition-colors ${
                              formErrors.email
                                ? 'border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/30'
                                : 'border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/70'
                            }`}
                          />
                          {formErrors.email && <p className="text-xs text-rose-600 dark:text-rose-400">{formErrors.email}</p>}
                        </div>

                        <div className="space-y-1.5">
                          <label
                            htmlFor="dentist-password"
                            className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                          >
                            Initial Password <span className="text-rose-500 dark:text-rose-400">*</span>
                          </label>
                          <div className="relative">
                            <input
                              id="dentist-password"
                              type={showPassword ? 'text' : 'password'}
                              required
                              placeholder="Min. 8 characters"
                              value={formData.password}
                              onChange={(e) => {
                                setFormData({ ...formData, password: e.target.value });
                                if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: undefined }));
                              }}
                              className={`w-full pl-3.5 pr-10 py-2.5 border rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 focus:outline-none transition-colors ${
                                formErrors.password
                                  ? 'border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/30'
                                  : 'border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/70'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((prev) => !prev)}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {formErrors.password && (
                            <p className="text-xs text-rose-600 dark:text-rose-400">{formErrors.password}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* License Number & Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor="dentist-license"
                            className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                          >
                            PRC License Number <span className="text-rose-500 dark:text-rose-400">*</span>
                          </label>
                          {editingDentist && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                              <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                              Locked
                            </span>
                          )}
                        </div>
                        <input
                          id="dentist-license"
                          type="text"
                          required
                          disabled={!!editingDentist}
                          placeholder="e.g., PRC-009876"
                          value={formData.license_number}
                          onChange={(e) => {
                            setFormData({ ...formData, license_number: e.target.value });
                            if (formErrors.license_number) setFormErrors((prev) => ({ ...prev, license_number: undefined }));
                          }}
                          className={`w-full px-3.5 py-2.5 border rounded-xl text-sm font-mono tabular-nums placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 focus:outline-none transition-colors ${
                            editingDentist
                              ? 'bg-slate-100 dark:bg-gray-900/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-gray-700 cursor-not-allowed'
                              : formErrors.license_number
                              ? 'border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/30 text-slate-900 dark:text-slate-100'
                              : 'border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/70 text-slate-900 dark:text-slate-100'
                          }`}
                        />
                        {formErrors.license_number && (
                          <p className="text-xs text-rose-600 dark:text-rose-400">{formErrors.license_number}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="dentist-phone"
                          className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          Direct Contact Phone <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <input
                          id="dentist-phone"
                          type="tel"
                          required
                          placeholder="+63 917 555 1234"
                          value={formData.phone}
                          onChange={(e) => {
                            setFormData({ ...formData, phone: e.target.value });
                            if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: undefined }));
                          }}
                          className={`w-full px-3.5 py-2.5 border rounded-xl text-sm tabular-nums text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 focus:outline-none transition-colors ${
                            formErrors.phone
                              ? 'border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/30'
                              : 'border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/70'
                          }`}
                        />
                        {formErrors.phone && <p className="text-xs text-rose-600 dark:text-rose-400">{formErrors.phone}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Clinical Assignment */}
                  <div className="space-y-3.5 pt-1 border-t border-slate-100 dark:border-gray-700/70">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 pt-3">
                      Clinical Assignment
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="dentist-specialization"
                          className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          Specialization
                        </label>
                        <div className="relative">
                          <select
                            id="dentist-specialization"
                            value={formData.specialization}
                            onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                            className="w-full appearance-none pl-3.5 pr-9 py-2.5 border border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 rounded-xl text-sm bg-white dark:bg-gray-900/70 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 focus:outline-none transition-colors cursor-pointer"
                          >
                            {specializationChoices.map((spec) => (
                              <option key={spec} value={spec} className="bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-100">
                                {spec}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            aria-hidden="true"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="dentist-chair"
                          className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          Default Operatory Chair
                        </label>
                        <div className="relative">
                          <select
                            id="dentist-chair"
                            value={formData.default_operatory_chair}
                            onChange={(e) => setFormData({ ...formData, default_operatory_chair: e.target.value })}
                            className="w-full appearance-none pl-3.5 pr-9 py-2.5 border border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 rounded-xl text-sm bg-white dark:bg-gray-900/70 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 focus:outline-none transition-colors cursor-pointer"
                          >
                            {chairChoices.map((chair) => (
                              <option key={chair} value={chair} className="bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-100">
                                {chair}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="dentist-bio"
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          <span>Professional Bio &amp; Clinical Background</span>
                          <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">
                            Optional
                          </span>
                        </label>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                          {bioLength} / 600
                        </span>
                      </div>
                      <textarea
                        id="dentist-bio"
                        rows="3"
                        maxLength={600}
                        placeholder="Education, board certifications, and clinical focus areas..."
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/70 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-sm leading-relaxed focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Active Practice Switch Card (Create Mode) */}
                  {!editingDentist && (
                    <label
                      htmlFor="dentist-active"
                      className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer ${
                        formData.is_active === 1
                          ? 'bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-200/90 dark:border-emerald-500/30'
                          : 'bg-slate-50/70 dark:bg-gray-900/50 border-slate-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            formData.is_active === 1
                              ? 'bg-emerald-100/80 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-200/80 dark:bg-gray-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {formData.is_active === 1 ? (
                            <CheckCircle className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <Lock className="w-4 h-4" aria-hidden="true" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
                            Active Practice Status
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {formData.is_active === 1
                              ? 'Allow immediate portal login and appointment scheduling.'
                              : 'Create account in inactive state until ready to accept bookings.'}
                          </span>
                        </div>
                      </div>
                      <div className="relative inline-flex items-center shrink-0">
                        <input
                          type="checkbox"
                          id="dentist-active"
                          checked={formData.is_active === 1}
                          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-6 rounded-full bg-slate-300 dark:bg-gray-600 peer-checked:bg-[#0D9488] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0D9488] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:shadow-xs after:transition-transform peer-checked:after:translate-x-4" />
                      </div>
                    </label>
                  )}
                </div>

                {/* Pinned Footer Actions */}
                <div className="px-6 py-3.5 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/60 dark:bg-gray-900/45 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {formSubmitting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : editingDentist ? (
                      <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>{editingDentist ? 'Save Changes' : 'Register Dentist'}</span>
                  </button>
                </div>
              </form>
            </div>
          </DialogOverlay>
        );
      })()}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.dentist && (
        <DialogOverlay
          onClose={() => setConfirmModal({ isOpen: false, dentist: null, targetStatus: 0, submitting: false })} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/65 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-slate-200 dark:border-gray-700 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-full ${
                  confirmModal.targetStatus === 0 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300'
                }`}
              >
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  {confirmModal.targetStatus === 0 ? 'Deactivate Practitioner?' : 'Activate Practitioner?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Dr. {confirmModal.dentist.first_name} {confirmModal.dentist.last_name}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
              {confirmModal.targetStatus === 0
                ? "Deactivating this practitioner's active status will suspend their login access and prevent new appointment booking. All prior patient consultations, treatment records, and appointment history are preserved."
                : 'Activating this practitioner will re-enable their portal login access and restore their clinical availability for appointment scheduling.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() =>
                  setConfirmModal({ isOpen: false, dentist: null, targetStatus: 0, submitting: false })
                }
                className="px-4 py-2 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmModal.submitting}
                onClick={handleConfirmStatusChange}
                className={`inline-flex items-center gap-2 px-4 py-2 font-medium text-sm text-white rounded-lg transition-colors ${
                  confirmModal.targetStatus === 0
                    ? 'bg-amber-600 dark:bg-amber-700 hover:bg-amber-700 dark:hover:bg-amber-600'
                    : 'bg-teal-600 dark:bg-[#0F766E] hover:bg-teal-700 dark:hover:bg-teal-600'
                }`}
              >
                {confirmModal.submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                {confirmModal.targetStatus === 0 ? 'Confirm Deactivation' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* Read-Only Dentist Details Modal */}
      {viewingDentist && (() => {
        const isActive = Boolean(viewingDentist.is_active);
        const hasBio = Boolean(String(viewingDentist.bio || '').trim());

        return (
          <DialogOverlay
            onClose={() => setViewingDentist(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-gray-700/80 w-full max-w-lg overflow-hidden max-h-[90dvh] flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-gray-700/80 bg-slate-50/70 dark:bg-gray-900/50">
                <div className="flex items-center gap-3.5 min-w-0">
                  {viewingDentist.avatar_url ? (
                    <img
                      src={viewingDentist.avatar_url}
                      alt={`Dr. ${viewingDentist.first_name} ${viewingDentist.last_name}`}
                      className="w-11 h-11 rounded-full object-cover border border-teal-200 dark:border-teal-500/35 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/90 dark:ring-teal-500/30 text-[#0F766E] dark:text-teal-300 flex items-center justify-center font-bold text-sm shrink-0">
                      {getDentistInitials(viewingDentist.first_name, viewingDentist.last_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                        Dr. {viewingDentist.first_name} {viewingDentist.last_name}
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                          isActive
                            ? 'bg-emerald-50 dark:bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30'
                            : 'bg-slate-100 dark:bg-gray-700/70 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-gray-600'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400'}`}
                          aria-hidden="true"
                        />
                        {isActive ? 'Active Practice' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                        Dentist #{viewingDentist.id}
                      </span>
                      <span className="text-slate-300 dark:text-gray-600" aria-hidden="true">·</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${getSpecializationBadgeClasses(viewingDentist.specialization)}`}
                      >
                        {viewingDentist.specialization}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingDentist(null)}
                  aria-label="Close dentist details"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-700/70 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
                {/* Key Credentials Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3.5 rounded-xl bg-slate-50/85 dark:bg-gray-900/55 border border-slate-200/80 dark:border-gray-700/80 space-y-1">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
                      PRC License
                    </span>
                    <span className="block font-mono text-sm font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                      {viewingDentist.license_number}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50/85 dark:bg-gray-900/55 border border-slate-200/80 dark:border-gray-700/80 space-y-1">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      <Stethoscope className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
                      Assigned Operatory
                    </span>
                    <span className="block text-sm font-bold text-slate-900 dark:text-slate-50">
                      {viewingDentist.default_operatory_chair || 'Operatory Chair 1'}
                    </span>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Contact Information
                  </h3>
                  <div className="rounded-xl border border-slate-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-900/40 divide-y divide-slate-100 dark:divide-gray-700/70">
                    {/* Email Row */}
                    <div className="px-3.5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <span className="text-[10.5px] text-slate-400 dark:text-slate-500 block">Account Email</span>
                          {viewingDentist.email ? (
                            <a
                              href={`mailto:${viewingDentist.email}`}
                              title={viewingDentist.email}
                              className="font-semibold text-slate-800 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-300 block truncate transition-colors"
                            >
                              {viewingDentist.email}
                            </a>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic block">Not provided</span>
                          )}
                        </div>
                      </div>
                      {viewingDentist.email && (
                        <button
                          type="button"
                          onClick={() => handleCopyContact('email', viewingDentist.email)}
                          aria-label="Copy dentist email"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors shrink-0 cursor-pointer"
                        >
                          {copiedField === 'email' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" aria-hidden="true" />
                              <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" aria-hidden="true" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Phone Row */}
                    <div className="px-3.5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                          <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <span className="text-[10.5px] text-slate-400 dark:text-slate-500 block">Contact Phone</span>
                          {viewingDentist.phone ? (
                            <a
                              href={`tel:${viewingDentist.phone}`}
                              className="font-semibold text-slate-800 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-300 tabular-nums block truncate transition-colors"
                            >
                              {viewingDentist.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic block">Not provided</span>
                          )}
                        </div>
                      </div>
                      {viewingDentist.phone && (
                        <button
                          type="button"
                          onClick={() => handleCopyContact('phone', viewingDentist.phone)}
                          aria-label="Copy dentist phone"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors shrink-0 cursor-pointer"
                        >
                          {copiedField === 'phone' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" aria-hidden="true" />
                              <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" aria-hidden="true" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Clinical Biography */}
                <div className="space-y-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                    Clinical Biography
                  </span>
                  <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-gray-900/45 border border-slate-200/80 dark:border-gray-700/80">
                    <p
                      className={`text-xs sm:text-sm leading-relaxed text-justify ${
                        hasBio
                          ? 'text-slate-700 dark:text-slate-200'
                          : 'text-slate-400 dark:text-slate-500 italic'
                      }`}
                    >
                      {hasBio ? viewingDentist.bio : 'No clinical biography recorded.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3.5 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/60 dark:bg-gray-900/45 flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  {canManageDentists && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingDentist;
                        setViewingDentist(null);
                        handleStatusToggleClick(target);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'border-amber-300/80 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                          : 'border-emerald-300/80 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setViewingDentist(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  {canManageDentists && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingDentist;
                        setViewingDentist(null);
                        openEditModal(target);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Edit Profile</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </DialogOverlay>
        );
      })()}
      {historyDentist && (
        <RecordHistoryModal
          entityType="dentist"
          entityId={historyDentist.id}
          title={`Dr. ${historyDentist.first_name} ${historyDentist.last_name} — Practice History`}
          onClose={() => setHistoryDentist(null)}
        />
      )}
    </div>
  );
}

export default DentistListPage;

