import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  Edit2,
  Power,
  RefreshCw,
  X,
  FileText
} from 'lucide-react';
import { servicesApi } from '../api';
import { TableSkeleton } from '../../../components/skeletons/TableSkeleton';
import { MobileSortControl } from '../../../components/ui/MobileSortControl';

import { DialogOverlay } from '../../../components/ui/DialogOverlay';
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const CATEGORY_OPTIONS = [
  'General',
  'Orthodontics',
  'Endodontics',
  'Periodontics',
  'Pediatric',
  'Oral Surgery',
  'Cosmetic',
  'Preventive',
];

export function ServicesPage() {
  const [services, setServices] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 10, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('ASC');
  const [page, setPage] = useState(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'General',
    description: '',
    price: '',
    duration_minutes: 30,
    is_active: 1,
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Confirmation Dialog
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    service: null,
    targetStatus: 0,
    submitting: false,
  });

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchServices = useCallback(async () => {
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
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter !== '') params.is_active = statusFilter;

      const res = await servicesApi.getAdminServices(params);
      setServices(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Error fetching services:', err);
      setError(err.response?.data?.error?.message || 'Failed to load dental services catalog.');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortDir, search, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

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
    setEditingService(null);
    setFormData({
      name: '',
      category: 'General',
      description: '',
      price: '',
      duration_minutes: 30,
      is_active: 1,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      category: service.category || 'General',
      description: service.description || '',
      price: service.price,
      duration_minutes: Number(service.duration_minutes) || 30,
      is_active: service.is_active ? 1 : 0,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.name.trim()) {
      errs.name = 'Service name is required.';
    } else if (formData.name.trim().length < 2 || formData.name.trim().length > 150) {
      errs.name = 'Service name must be between 2 and 150 characters.';
    }

    if (formData.price === '' || isNaN(formData.price) || Number(formData.price) < 0) {
      errs.price = 'Please enter a valid price (₱0.00 or higher).';
    }

    if (!DURATION_OPTIONS.includes(Number(formData.duration_minutes))) {
      errs.duration_minutes = 'Select a valid duration (15, 30, 45, 60, 90, 120 minutes).';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setFormSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        description: formData.description.trim() || null,
        price: Number(formData.price),
        duration_minutes: Number(formData.duration_minutes),
        is_active: formData.is_active ? 1 : 0,
      };

      if (editingService) {
        await servicesApi.updateService(editingService.id, payload);
        showToast(`Service "${payload.name}" updated successfully.`);
      } else {
        await servicesApi.createService(payload);
        showToast(`Service "${payload.name}" created successfully.`);
      }

      setIsModalOpen(false);
      fetchServices();
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

  const handleStatusToggleClick = (service) => {
    const targetStatus = service.is_active ? 0 : 1;
    setConfirmModal({
      isOpen: true,
      service,
      targetStatus,
      submitting: false,
    });
  };

  const handleConfirmStatusChange = async () => {
    const { service, targetStatus } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, submitting: true }));

    try {
      await servicesApi.toggleServiceStatus(service.id, targetStatus === 1);
      showToast(
        `Service "${service.name}" ${targetStatus === 1 ? 'activated' : 'deactivated'} successfully.`
      );
      setConfirmModal({ isOpen: false, service: null, targetStatus: 0, submitting: false });
      fetchServices();
    } catch (err) {
      console.error('Failed to change status:', err);
      showToast(err.response?.data?.error?.message || 'Failed to update service status.', 'error');
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Dental Services Catalog</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure clinical procedures, appointment duration blocks, treatment fees, and booking availability.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 dark:bg-[#0F766E] hover:bg-teal-700 dark:hover:bg-[#0D9488] text-white font-medium text-sm rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-teal-500 focus:outline-none"
        >
          <Plus className="w-4 h-4" />
          Add Dental Service
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search service or category"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full min-h-11 sm:min-h-0 pl-9 pr-4 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="flex-1 sm:flex-none min-w-[9rem] min-h-11 sm:min-h-0 px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-base sm:text-sm bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:outline-none"
          >
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="flex-1 sm:flex-none min-w-[9rem] min-h-11 sm:min-h-0 px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-base sm:text-sm bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="1">Active Only</option>
            <option value="0">Inactive Only</option>
          </select>

          <button
            onClick={fetchServices}
            title="Refresh" aria-label="Refresh services"
            className="inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 p-2 border border-slate-300 dark:border-gray-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Table / State Views */}
      {loading && services.length === 0 ? (
        <TableSkeleton
          rows={6}
          columns={['w-12', 'w-44', 'w-28', 'w-24', 'w-20', 'w-24', 'w-28']}
        />
      ) : (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {error ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto mb-3" />
            <p className="text-slate-800 dark:text-slate-100 font-medium">{error}</p>
            <button
              onClick={fetchServices}
              className="mt-4 px-4 py-2 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : services.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
            <h3 className="text-slate-800 dark:text-slate-100 font-medium">No dental services found</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {search || categoryFilter || statusFilter !== ''
                ? 'Try adjusting your filters or search terms.'
                : 'Get started by creating your clinic’s first procedure.'}
            </p>
          </div>
        ) : (
          <>
          <MobileSortControl sortBy={sortBy} sortDir={sortDir} onSort={handleSort} options={[{ value: 'name', label: 'Service name' }, { value: 'category', label: 'Category' }, { value: 'price', label: 'Fee' }, { value: 'duration_minutes', label: 'Duration' }, { value: 'is_active', label: 'Status' }, { value: 'id', label: 'ID' }]} />
          <div className="overflow-x-auto">
            <table role="table" className="tch-responsive-table w-full text-left border-collapse">
              <thead role="rowgroup">
                <tr role="row" className="bg-slate-50/80 dark:bg-gray-900/60 border-b border-slate-200 dark:border-gray-700 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'id' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('id')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('id'); } }}>
                    <div className="flex items-center gap-1.5">
                      ID
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'name' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('name')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('name'); } }}>
                    <div className="flex items-center gap-1.5">
                      Service Name
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'category' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('category')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('category'); } }}>
                    <div className="flex items-center gap-1.5">
                      Category
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'price' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('price')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('price'); } }}>
                    <div className="flex items-center gap-1.5">
                      Fee (PHP)
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'duration_minutes' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('duration_minutes')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('duration_minutes'); } }}>
                    <div className="flex items-center gap-1.5">
                      Duration
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'is_active' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('is_active')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('is_active'); } }}>
                    <div className="flex items-center gap-1.5">
                      Status
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    </div>
                  </th>
                  <th role="columnheader" className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/70 text-sm">
                {services.map((service) => (
                  <tr role="row" key={service.id} className="hover:bg-slate-50/60 dark:hover:bg-gray-700/40 transition-colors">
                    <td role="cell" data-label="ID" className="py-3.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">#{service.id}</td>
                    <td role="cell" data-label="Service Name" className="py-3.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{service.name}</div>
                      {service.description && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-sm">
                          {service.description}
                        </div>
                      )}
                    </td>
                    <td role="cell" data-label="Category" className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-200">
                        {service.category || 'General'}
                      </span>
                    </td>
                    <td role="cell" data-label="Fee (PHP)" className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      ₱{Number(service.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td role="cell" data-label="Duration" className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                        <Clock className="w-3 h-3" />
                        {service.duration_minutes} min
                      </span>
                    </td>
                    <td role="cell" data-label="Status" className="py-3.5 px-4">
                      {service.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td role="cell" data-label="Actions" className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => openEditModal(service)}
                        className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Edit Service"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStatusToggleClick(service)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          service.is_active
                            ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                            : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                        }`}
                        title={service.is_active ? 'Deactivate Service' : 'Activate Service'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* Pagination Bar */}
        {meta.total > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing <span className="font-medium text-slate-700 dark:text-slate-200">{(meta.page - 1) * meta.per_page + 1}</span> to{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {Math.min(meta.page * meta.per_page, meta.total)}
              </span>{' '}
              of <span className="font-medium text-slate-700 dark:text-slate-200">{meta.total}</span> procedures
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={meta.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Page {meta.page} of {meta.last_page}
              </span>
              <button
                disabled={meta.page >= meta.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Service Create / Edit Modal */}
      {isModalOpen && (
        <DialogOverlay
          onClose={() => setIsModalOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/65 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-slate-200 dark:border-gray-700 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/60">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {editingService ? 'Edit Dental Service' : 'Add New Dental Service'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formErrors.general && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200 text-sm rounded-lg">
                  {formErrors.general}
                </div>
              )}

              {/* Service Name */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                  Procedure Name <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Comprehensive Oral Prophylaxis"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3.5 py-2 border rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:outline-none ${
                    formErrors.name ? 'border-rose-400 bg-rose-50/30 dark:bg-rose-950/30' : 'border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                  }`}
                />
                {formErrors.name && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{formErrors.name}</p>}
              </div>

              {/* Category & Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:outline-none"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Duration (Minutes) <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:outline-none"
                  >
                    {DURATION_OPTIONS.map((mins) => (
                      <option key={mins} value={mins}>
                        {mins} minutes
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                  Treatment Fee (PHP ₱) <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 dark:text-slate-400 font-semibold text-sm">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="1500.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className={`w-full pl-8 pr-3.5 py-2 border rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:outline-none ${
                      formErrors.price ? 'border-rose-400 bg-rose-50/30 dark:bg-rose-950/30' : 'border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                    }`}
                  />
                </div>
                {formErrors.price && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{formErrors.price}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                  Clinical Description
                </label>
                <textarea
                  rows="3"
                  placeholder="Detail instructions, scope, or patient notes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:outline-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="service-active"
                  checked={formData.is_active === 1}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 dark:border-gray-600 focus:ring-teal-500"
                />
                <label htmlFor="service-active" className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                  Enable active booking availability for this service
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-slate-200 font-medium text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 dark:bg-[#0F766E] hover:bg-teal-700 dark:hover:bg-[#0D9488] text-white font-medium text-sm rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {formSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingService ? 'Save Changes' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}

      {/* Deactivation / Activation Confirmation Dialog */}
      {confirmModal.isOpen && confirmModal.service && (
        <DialogOverlay
          onClose={() => setConfirmModal({ isOpen: false, service: null, targetStatus: 0, submitting: false })} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/65 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-slate-200 dark:border-gray-700 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-full ${
                  confirmModal.targetStatus === 0 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {confirmModal.targetStatus === 0 ? 'Deactivate Service?' : 'Activate Service?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{confirmModal.service.name}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmModal.targetStatus === 0
                ? 'Deactivating this service will remove it from future appointment bookings. All past patient appointments, treatments, and billing records referencing this service will remain securely preserved.'
                : 'Activating this service will immediately make it selectable for patients and receptionists when booking new dental appointments.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() =>
                  setConfirmModal({ isOpen: false, service: null, targetStatus: 0, submitting: false })
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
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-teal-600 dark:bg-[#0F766E] hover:bg-teal-700 dark:hover:bg-[#0D9488]'
                }`}
              >
                {confirmModal.submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                {confirmModal.targetStatus === 0 ? 'Confirm Deactivation' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}

export default ServicesPage;

