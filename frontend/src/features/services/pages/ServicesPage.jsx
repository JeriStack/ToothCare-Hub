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
  FileText,
  Eye,
  Lock,
  ChevronDown
} from 'lucide-react';
import { servicesApi } from '../api';
import { useAuth } from '../../auth';
import { TableSkeleton } from '../../../components/skeletons/TableSkeleton';
import { MobileSortControl } from '../../../components/ui/MobileSortControl';


import { DialogOverlay } from '../../../components/ui/DialogOverlay';
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const CATEGORY_OPTIONS = [
  'General',
  'Preventive',
  'Restorative',
  'Cosmetic',
  'Oral Surgery',
  'Orthodontics',
  'Endodontics',
  'Periodontics',
  'Pediatric',
];

function getCategoryBadgeClasses(category) {
  switch ((category || 'General').toLowerCase()) {
    case 'preventive':
      return 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200/80 dark:border-teal-500/25';
    case 'restorative':
      return 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-500/25';
    case 'cosmetic':
      return 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-500/25';
    case 'oral surgery':
      return 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/25';
    case 'endodontics':
    case 'periodontics':
      return 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/25';
    case 'orthodontics':
      return 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-500/25';
    case 'pediatric':
      return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/25';
    default:
      return 'bg-slate-100 dark:bg-gray-700/70 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-gray-600';
  }
}

export function ServicesPage() {
  const { user, hasPermission } = useAuth();
  const canManageServices = Boolean(
    (typeof hasPermission === 'function' && hasPermission('services.manage')) || user?.role === 'ADMIN'
  );

  const [services, setServices] = useState([]);
  const [viewingService, setViewingService] = useState(null);
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
    if (!canManageServices) return;
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
    if (!canManageServices) return;
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
    if (!canManageServices) return;
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
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Dental Services Catalog</h1>
            {!canManageServices && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-gray-700">
                <Lock className="w-3 h-3" aria-hidden="true" />
                View-Only Access
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {canManageServices
              ? 'Configure clinical procedures, appointment duration blocks, treatment fees, and booking availability.'
              : 'Browse clinical procedures, appointment duration blocks, standardized fees, and booking availability.'}
          </p>
        </div>
        {canManageServices && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 dark:bg-[#0F766E] hover:bg-teal-700 dark:hover:bg-[#0D9488] text-white font-medium text-sm rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Dental Service
          </button>
        )}
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
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden transition-colors">
        {error ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto mb-3" />
            <p className="text-slate-800 dark:text-slate-100 font-medium">{error}</p>
            <button
              type="button"
              onClick={fetchServices}
              className="mt-4 px-4 py-2 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : services.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-700 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-slate-800 dark:text-slate-100 font-semibold">No dental services found</h3>
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
                <tr role="row" className="bg-slate-50/75 dark:bg-gray-900/45 border-b border-slate-100 dark:border-gray-700/80 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'id' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('id')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('id'); } }}>
                    <div className="flex items-center gap-1.5">
                      ID
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'id' ? 'text-[#0D9488] dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'name' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('name')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('name'); } }}>
                    <div className="flex items-center gap-1.5">
                      Service
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'name' ? 'text-[#0D9488] dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'category' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('category')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('category'); } }}>
                    <div className="flex items-center gap-1.5">
                      Category
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'category' ? 'text-[#0D9488] dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'price' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('price')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('price'); } }}>
                    <div className="flex items-center gap-1.5">
                      Fee (PHP)
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'price' ? 'text-[#0D9488] dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'duration_minutes' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('duration_minutes')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('duration_minutes'); } }}>
                    <div className="flex items-center gap-1.5">
                      Duration
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'duration_minutes' ? 'text-[#0D9488] dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    </div>
                  </th>
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
                {services.map((service) => (
                  <tr role="row" key={service.id} className="hover:bg-slate-50/75 dark:hover:bg-gray-700/30 transition-colors">
                    <td role="cell" data-label="ID" className="py-3.5 px-5 font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                      #{service.id}
                    </td>
                    <td role="cell" data-label="Service" className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 dark:text-slate-50">
                        {service.name}
                      </span>
                    </td>
                    <td role="cell" data-label="Category" className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getCategoryBadgeClasses(service.category)}`}>
                        {service.category || 'General'}
                      </span>
                    </td>
                    <td role="cell" data-label="Fee (PHP)" className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-50 tabular-nums">
                      <span className="text-slate-400 dark:text-slate-500 font-medium mr-0.5">₱</span>
                      {Number(service.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td role="cell" data-label="Duration" className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100/90 dark:bg-gray-900/60 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-gray-700 tabular-nums">
                        <Clock className="w-3 h-3 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
                        {service.duration_minutes} min
                      </span>
                    </td>
                    <td role="cell" data-label="Status" className="py-3.5 px-4">
                      {service.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden="true" />
                          Active
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
                          onClick={() => setViewingService(service)}
                          className="w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-slate-600 dark:text-slate-300 hover:text-[#0F766E] dark:hover:text-teal-300 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-950/30 inline-flex items-center justify-center transition-colors cursor-pointer"
                          title="View Service Details"
                          aria-label={`View ${service.name}`}
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        {canManageServices && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(service)}
                              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-slate-600 dark:text-slate-300 hover:text-[#0F766E] dark:hover:text-teal-300 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-950/30 inline-flex items-center justify-center transition-colors cursor-pointer"
                              title="Edit Service"
                              aria-label={`Edit ${service.name}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusToggleClick(service)}
                              className={`w-8 h-8 rounded-lg border inline-flex items-center justify-center transition-colors cursor-pointer ${
                                service.is_active
                                  ? 'border-rose-200/80 dark:border-rose-800/70 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                                  : 'border-emerald-200/80 dark:border-emerald-800/70 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                              }`}
                              title={service.is_active ? 'Deactivate Service' : 'Activate Service'}
                              aria-label={`${service.is_active ? 'Deactivate' : 'Activate'} ${service.name}`}
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

        {/* Pagination Bar */}
        {meta.total > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/50 dark:bg-gray-900/35 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="tabular-nums">
              Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{(meta.page - 1) * meta.per_page + 1}</span> to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {Math.min(meta.page * meta.per_page, meta.total)}
              </span>{' '}
              of <span className="font-semibold text-slate-700 dark:text-slate-200">{meta.total}</span> procedures
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={meta.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-slate-200 font-semibold tabular-nums">
                Page {meta.page} of {meta.last_page}
              </span>
              <button
                type="button"
                disabled={meta.page >= meta.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-gray-700/80 w-full max-w-lg overflow-hidden max-h-[90dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-gray-700/80 bg-slate-50/70 dark:bg-gray-900/50">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/90 dark:ring-teal-500/30 text-[#0F766E] dark:text-teal-300 flex items-center justify-center shrink-0">
                  {editingService ? <Edit2 className="w-4 h-4" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                    {editingService ? 'Edit Dental Service' : 'Add Dental Service'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {editingService
                      ? `Service #${editingService.id} · Update pricing, duration, and visibility`
                      : 'Configure procedure details, fee, and booking availability'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close service form"
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

                {/* Live Compact Preview Strip */}
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50/90 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-700/70 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          formData.is_active === 1 ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {formData.name.trim() || 'Untitled Dental Procedure'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getCategoryBadgeClasses(formData.category)}`}
                      >
                        {formData.category || 'General'}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                        · {formData.duration_minutes}m
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <span className="block text-sm font-extrabold text-[#0F766E] dark:text-teal-300">
                      ₱{Number(formData.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="block text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      {formData.is_active === 1 ? 'Bookable' : 'Hidden'}
                    </span>
                  </div>
                </div>

                {/* Service Name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="service-name-input"
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    Procedure Name <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <input
                    id="service-name-input"
                    type="text"
                    required
                    maxLength={150}
                    placeholder="e.g., Dental Prophylaxis (Cleaning)"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 focus:outline-none transition-colors ${
                      formErrors.name
                        ? 'border-rose-400 bg-rose-50/30 dark:bg-rose-950/30'
                        : 'border-slate-300 dark:border-gray-600/90 bg-white dark:bg-gray-900/70 hover:border-slate-400 dark:hover:border-gray-500'
                    }`}
                  />
                  {formErrors.name && <p className="text-xs text-rose-600 dark:text-rose-400">{formErrors.name}</p>}
                </div>

                {/* Category & Treatment Fee */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="service-category-select"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      Category
                    </label>
                    <div className="relative">
                      <select
                        id="service-category-select"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full appearance-none pl-3.5 pr-9 py-2.5 border border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 rounded-xl text-sm bg-white dark:bg-gray-900/70 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 focus:outline-none transition-colors cursor-pointer"
                      >
                        {CATEGORY_OPTIONS.map((cat) => (
                          <option key={cat} value={cat} className="bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-100">
                            {cat}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="w-4 h-4 text-slate-400 dark:text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="service-price-input"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      Treatment Fee (PHP) <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-0 inset-y-0 w-9 flex items-center justify-center text-slate-500 dark:text-slate-400 font-semibold text-sm border-r border-slate-200 dark:border-gray-700/80 pointer-events-none">
                        ₱
                      </span>
                      <input
                        id="service-price-input"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        placeholder="1500.00"
                        value={formData.price}
                        onChange={(e) => {
                          setFormData({ ...formData, price: e.target.value });
                          if (formErrors.price) setFormErrors((prev) => ({ ...prev, price: undefined }));
                        }}
                        className={`w-full pl-11 pr-3.5 py-2.5 border rounded-xl text-sm font-medium tabular-nums text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 focus:outline-none transition-colors ${
                          formErrors.price
                            ? 'border-rose-400 bg-rose-50/30 dark:bg-rose-950/30'
                            : 'border-slate-300 dark:border-gray-600/90 bg-white dark:bg-gray-900/70 hover:border-slate-400 dark:hover:border-gray-500'
                        }`}
                      />
                    </div>
                    {formErrors.price && <p className="text-xs text-rose-600 dark:text-rose-400">{formErrors.price}</p>}
                  </div>
                </div>

                {/* Duration Quick-Select Pills */}
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                    <span>
                      Duration <span className="text-rose-500 dark:text-rose-400">*</span>
                    </span>
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" role="group" aria-label="Service duration in minutes">
                    {DURATION_OPTIONS.map((mins) => {
                      const selected = Number(formData.duration_minutes) === mins;
                      return (
                        <button
                          key={mins}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setFormData({ ...formData, duration_minutes: mins });
                            if (formErrors.duration_minutes) {
                              setFormErrors((prev) => ({ ...prev, duration_minutes: undefined }));
                            }
                          }}
                          className={`py-2 px-2 rounded-xl text-xs font-semibold tabular-nums border transition-all cursor-pointer ${
                            selected
                              ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-500 dark:border-teal-400 text-[#0F766E] dark:text-teal-200 ring-1 ring-teal-500/30 shadow-2xs'
                              : 'bg-white dark:bg-gray-900/60 border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-teal-400 dark:hover:border-teal-500/60 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                        >
                          {mins}m
                        </button>
                      );
                    })}
                  </div>
                  {formErrors.duration_minutes && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">{formErrors.duration_minutes}</p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="service-desc-input"
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      <span>Clinical Description</span>
                      <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">
                        Optional
                      </span>
                    </label>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {(formData.description || '').length} / 500
                    </span>
                  </div>
                  <textarea
                    id="service-desc-input"
                    rows="3"
                    maxLength={500}
                    placeholder="Brief clinical scope, preparation notes, or patient expectations..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600/90 hover:border-slate-400 dark:hover:border-gray-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-sm leading-relaxed focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 focus:outline-none transition-colors"
                  />
                </div>

                {/* Active Booking Switch Card */}
                <label
                  htmlFor="service-active"
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
                        Available for Online Booking
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {formData.is_active === 1
                          ? 'Visible to patients and staff when scheduling appointments.'
                          : 'Hidden from new bookings; historical records remain intact.'}
                      </span>
                    </div>
                  </div>
                  <div className="relative inline-flex items-center shrink-0">
                    <input
                      type="checkbox"
                      id="service-active"
                      checked={formData.is_active === 1}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 rounded-full bg-slate-300 dark:bg-gray-600 peer-checked:bg-[#0D9488] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0D9488] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:shadow-xs after:transition-transform peer-checked:after:translate-x-4" />
                  </div>
                </label>
              </div>

              {/* Footer Actions */}
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
                  ) : editingService ? (
                    <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{editingService ? 'Save Changes' : 'Create Service'}</span>
                </button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}

      {/* Deactivation / Activation Confirmation Dialog */}
      {canManageServices && confirmModal.isOpen && confirmModal.service && (
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

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
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

      {/* Read-Only Service Details Modal */}
      {viewingService && (() => {
        const hasDescription = Boolean(String(viewingService.description || '').trim());
        const isActive = Boolean(viewingService.is_active);

        return (
          <DialogOverlay
            onClose={() => setViewingService(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-gray-700/80 w-full max-w-lg overflow-hidden max-h-[90dvh] flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-gray-700/80 bg-slate-50/70 dark:bg-gray-900/50">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/90 dark:ring-teal-500/30 text-[#0F766E] dark:text-teal-300 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                        {viewingService.name}
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
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                        Service #{viewingService.id}
                      </span>
                      <span className="text-slate-300 dark:text-gray-600" aria-hidden="true">·</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${getCategoryBadgeClasses(viewingService.category)}`}
                      >
                        {viewingService.category || 'General'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingService(null)}
                  aria-label="Close service details"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-700/70 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
                {/* Key Specs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3.5 rounded-xl bg-slate-50/85 dark:bg-gray-900/55 border border-slate-200/80 dark:border-gray-700/80 space-y-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      Standard Fee
                    </span>
                    <span className="block text-base font-extrabold text-[#0F766E] dark:text-teal-300 tabular-nums tracking-tight">
                      ₱{Number(viewingService.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50/85 dark:bg-gray-900/55 border border-slate-200/80 dark:border-gray-700/80 space-y-1">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                      Duration
                    </span>
                    <span className="block text-base font-extrabold text-slate-900 dark:text-slate-50 tabular-nums tracking-tight">
                      {viewingService.duration_minutes} min
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50/85 dark:bg-gray-900/55 border border-slate-200/80 dark:border-gray-700/80 space-y-1">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {isActive ? (
                        <CheckCircle className="w-3 h-3 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
                      ) : (
                        <Lock className="w-3 h-3 text-slate-400" aria-hidden="true" />
                      )}
                      Booking Status
                    </span>
                    <span
                      className={`block text-base font-extrabold tracking-tight ${
                        isActive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isActive ? 'Bookable' : 'Hidden'}
                    </span>
                  </div>
                </div>

                {/* Clinical Description */}
                <div className="space-y-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                    Clinical Description
                  </span>
                  <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-gray-900/45 border border-slate-200/80 dark:border-gray-700/80">
                    <p
                      className={`text-xs sm:text-sm leading-relaxed ${
                        hasDescription
                          ? 'text-slate-700 dark:text-slate-200'
                          : 'text-slate-400 dark:text-slate-500 italic'
                      }`}
                    >
                      {hasDescription ? viewingService.description : 'No clinical description provided.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3.5 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/60 dark:bg-gray-900/45 flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  {canManageServices && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingService;
                        setViewingService(null);
                        handleStatusToggleClick(target);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'border-rose-200 dark:border-rose-500/35 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                          : 'border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
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
                    onClick={() => setViewingService(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  {canManageServices && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingService;
                        setViewingService(null);
                        openEditModal(target);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Edit Service</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </DialogOverlay>
        );
      })()}
    </div>
  );
}

export default ServicesPage;

