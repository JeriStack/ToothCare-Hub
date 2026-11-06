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
  UserCheck
} from 'lucide-react';
import { dentistsApi } from '../api';
import { TableSkeleton } from '../../../components/skeletons/TableSkeleton';

const SPECIALIZATION_OPTIONS = [
  'General Dentistry',
  'Orthodontics',
  'Endodontics',
  'Periodontics',
  'Pediatric Dentistry',
  'Prosthodontics',
  'Oral & Maxillofacial Surgery',
  'Cosmetic Dentistry',
];

const OPERATORY_CHAIR_OPTIONS = ['Chair 1', 'Chair 2', 'Chair 3', 'Chair 4', 'Surgical Suite'];

export function DentistListPage() {
  const [dentists, setDentists] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 10, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('ASC');
  const [page, setPage] = useState(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDentist, setEditingDentist] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    license_number: '',
    specialization: 'General Dentistry',
    phone: '',
    default_operatory_chair: 'Chair 1',
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
        per_page: 10,
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
  }, [page, sortBy, sortDir, search, specializationFilter, statusFilter]);

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
    setEditingDentist(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      license_number: '',
      specialization: 'General Dentistry',
      phone: '',
      default_operatory_chair: 'Chair 1',
      bio: '',
      is_active: 1,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (dentist) => {
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
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm text-white ${
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clinic Dentist Roster</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage licensed dental practitioners, PRC credentials, assigned operatories, and active practice schedules.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-teal-500 focus:outline-none"
        >
          <Plus className="w-4 h-4" />
          Add Licensed Dentist
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by practitioner name, license number, or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={specializationFilter}
            onChange={(e) => {
              setSpecializationFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
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
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="1">Active Practice</option>
            <option value="0">Inactive / On Leave</option>
          </select>

          <button
            onClick={fetchDentists}
            title="Refresh Roster"
            className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {error ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
            <p className="text-slate-800 font-medium">{error}</p>
            <button
              onClick={fetchDentists}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : dentists.length === 0 ? (
          <div className="p-12 text-center">
            <Stethoscope className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="text-slate-800 font-medium">No dental practitioners found</h3>
            <p className="text-slate-500 text-sm mt-1">
              {search || specializationFilter || statusFilter !== ''
                ? 'Try adjusting your search criteria or filters.'
                : 'Get started by adding your clinic’s first practitioner.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 cursor-pointer" onClick={() => handleSort('id')}>
                    <div className="flex items-center gap-1.5">
                      ID
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1.5">
                      Practitioner Name
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer" onClick={() => handleSort('specialization')}>
                    <div className="flex items-center gap-1.5">
                      Specialization
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer" onClick={() => handleSort('license_number')}>
                    <div className="flex items-center gap-1.5">
                      PRC License
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Operatory</th>
                  <th className="py-3.5 px-4 cursor-pointer" onClick={() => handleSort('is_active')}>
                    <div className="flex items-center gap-1.5">
                      Status
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {dentists.map((dentist) => (
                  <tr key={dentist.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500">#{dentist.id}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">
                        Dr. {dentist.first_name} {dentist.last_name}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {dentist.email || '—'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {dentist.phone}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
                        {dentist.specialization}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                      {dentist.license_number}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                      {dentist.default_operatory_chair || 'Chair 1'}
                    </td>
                    <td className="py-3.5 px-4">
                      {dentist.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          <CheckCircle className="w-3 h-3" />
                          Active Practice
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => openEditModal(dentist)}
                        className="p-1.5 text-slate-600 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit Profile"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStatusToggleClick(dentist)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          dentist.is_active
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={dentist.is_active ? 'Deactivate Dentist' : 'Activate Dentist'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {meta.total > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-medium text-slate-700">{(meta.page - 1) * meta.per_page + 1}</span> to{' '}
              <span className="font-medium text-slate-700">
                {Math.min(meta.page * meta.per_page, meta.total)}
              </span>{' '}
              of <span className="font-medium text-slate-700">{meta.total}</span> dentists
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={meta.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-300 rounded bg-white text-slate-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Previous
              </button>
              <span className="font-medium text-slate-700">
                Page {meta.page} of {meta.last_page}
              </span>
              <button
                disabled={meta.page >= meta.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-slate-300 rounded bg-white text-slate-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Dentist Modal (Create / Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingDentist ? 'Edit Dentist Profile' : 'Register Licensed Dentist'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {formErrors.general && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
                  {formErrors.general}
                </div>
              )}

              {/* Names */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Maria"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className={`w-full px-3.5 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none ${
                      formErrors.first_name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.first_name && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.first_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Santos"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className={`w-full px-3.5 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none ${
                      formErrors.last_name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.last_name && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.last_name}</p>
                  )}
                </div>
              </div>

              {/* Credentials / Auth (Only for new dentist) */}
              {!editingDentist && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                      Account Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="dr.santos@toothcare.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full px-3.5 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none ${
                        formErrors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                      }`}
                    />
                    {formErrors.email && <p className="text-xs text-rose-600 mt-1">{formErrors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                      Initial Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`w-full px-3.5 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none ${
                        formErrors.password ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                      }`}
                    />
                    {formErrors.password && (
                      <p className="text-xs text-rose-600 mt-1">{formErrors.password}</p>
                    )}
                  </div>
                </div>
              )}

              {/* License Number & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    PRC License Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingDentist}
                    placeholder="PRC-DEN-009876"
                    value={formData.license_number}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    className={`w-full px-3.5 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono ${
                      editingDentist ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.license_number && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.license_number}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Direct Contact Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+63 917 555 1234"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full px-3.5 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none ${
                      formErrors.phone ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.phone && <p className="text-xs text-rose-600 mt-1">{formErrors.phone}</p>}
                </div>
              </div>

              {/* Specialization & Operatory Chair */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Specialization
                  </label>
                  <select
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {SPECIALIZATION_OPTIONS.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Default Operatory Chair
                  </label>
                  <select
                    value={formData.default_operatory_chair}
                    onChange={(e) => setFormData({ ...formData, default_operatory_chair: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {OPERATORY_CHAIR_OPTIONS.map((chair) => (
                      <option key={chair} value={chair}>
                        {chair}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Professional Bio & Clinical Background
                </label>
                <textarea
                  rows="3"
                  placeholder="Doctor's education, certifications, and special clinical interests..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* Active Toggle (Only for create) */}
              {!editingDentist && (
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="dentist-active"
                    checked={formData.is_active === 1}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                  />
                  <label htmlFor="dentist-active" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Enable immediate active practice status and appointment availability
                  </label>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {formSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingDentist ? 'Save Changes' : 'Register Dentist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.dentist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-full ${
                  confirmModal.targetStatus === 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {confirmModal.targetStatus === 0 ? 'Deactivate Practitioner?' : 'Activate Practitioner?'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Dr. {confirmModal.dentist.first_name} {confirmModal.dentist.last_name}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
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
                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmModal.submitting}
                onClick={handleConfirmStatusChange}
                className={`inline-flex items-center gap-2 px-4 py-2 font-medium text-sm text-white rounded-lg transition-colors ${
                  confirmModal.targetStatus === 0
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                {confirmModal.submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                {confirmModal.targetStatus === 0 ? 'Confirm Deactivation' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DentistListPage;

