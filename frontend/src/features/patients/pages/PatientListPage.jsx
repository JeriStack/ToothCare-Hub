import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Edit2,
  Power,
  RefreshCw,
  X,
  Phone,
  Mail,
  Calendar,
  HeartPulse,
  Shield,
  FileText
} from 'lucide-react';
import { patientsApi } from '../api';
import { TableSkeleton } from '../../../components/skeletons/TableSkeleton';
import { MobileSortControl } from '../../../components/ui/MobileSortControl';

import { DialogOverlay } from '../../../components/ui/DialogOverlay';
const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

export function PatientListPage() {
  const [patients, setPatients] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 10, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('DESC');
  const [page, setPage] = useState(1);

  // Modal State for View & Edit
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    phone: '',
    gender: 'PREFER_NOT_TO_SAY',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medical_alerts: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Account Status Confirmation
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    patient: null,
    targetStatus: 0,
    submitting: false,
  });

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPatients = useCallback(async () => {
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
      if (genderFilter) params.gender = genderFilter;
      if (statusFilter !== '') params.is_active = statusFilter;

      const res = await patientsApi.getAdminPatients(params);
      setPatients(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError(err.response?.data?.error?.message || 'Failed to load patient registry.');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortDir, search, genderFilter, statusFilter]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortDir('ASC');
    }
    setPage(1);
  };

  const openDetailsModal = async (patient) => {
    try {
      const full = await patientsApi.getPatient(patient.id);
      setSelectedPatient(full || patient);
      setFormData({
        first_name: full?.first_name || patient.first_name,
        last_name: full?.last_name || patient.last_name,
        date_of_birth: full?.date_of_birth || patient.date_of_birth,
        phone: full?.phone || patient.phone,
        gender: full?.gender || patient.gender || 'PREFER_NOT_TO_SAY',
        address: full?.address || patient.address || '',
        emergency_contact_name: full?.emergency_contact_name || patient.emergency_contact_name || '',
        emergency_contact_phone: full?.emergency_contact_phone || patient.emergency_contact_phone || '',
        medical_alerts: full?.medical_alerts || patient.medical_alerts || '',
      });
      setFormErrors({});
      setIsModalOpen(true);
    } catch (err) {
      console.error('Failed to get patient details:', err);
      showToast('Failed to load patient profile details.', 'error');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      setFormErrors({ general: 'First and last names are required.' });
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        date_of_birth: formData.date_of_birth,
        phone: formData.phone.trim(),
        gender: formData.gender,
        address: formData.address.trim() || null,
        emergency_contact_name: formData.emergency_contact_name.trim() || null,
        emergency_contact_phone: formData.emergency_contact_phone.trim() || null,
        medical_alerts: formData.medical_alerts.trim() || null,
      };

      await patientsApi.updatePatient(selectedPatient.id, payload);
      showToast(`Patient #${selectedPatient.id} updated successfully.`);
      setIsModalOpen(false);
      fetchPatients();
    } catch (err) {
      const apiErrors = err.response?.data?.error?.details;
      if (apiErrors && typeof apiErrors === 'object') {
        setFormErrors(apiErrors);
      } else {
        setFormErrors({ general: err.response?.data?.error?.message || 'Update failed.' });
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleStatusToggleClick = (patient) => {
    const targetStatus = patient.is_active ? 0 : 1;
    setConfirmModal({
      isOpen: true,
      patient,
      targetStatus,
      submitting: false,
    });
  };

  const handleConfirmStatusChange = async () => {
    const { patient, targetStatus } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, submitting: true }));

    try {
      await patientsApi.togglePatientStatus(patient.id, targetStatus === 1);
      showToast(
        `Patient "${patient.first_name} ${patient.last_name}" account ${
          targetStatus === 1 ? 'activated' : 'disabled'
        } successfully.`
      );
      setConfirmModal({ isOpen: false, patient: null, targetStatus: 0, submitting: false });
      fetchPatients();
      if (isModalOpen && selectedPatient?.id === patient.id) {
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to change status:', err);
      showToast(err.response?.data?.error?.message || 'Failed to update account status.', 'error');
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">Patient Registry & Records</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Search demographic profiles, review clinical medical alerts, manage emergency contacts, and oversee account access.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4 transition-colors">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search name, email, or phone"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full min-h-11 sm:min-h-0 pl-9 pr-4 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={genderFilter}
            onChange={(e) => {
              setGenderFilter(e.target.value);
              setPage(1);
            }}
            className="flex-1 sm:flex-none min-w-[9rem] min-h-11 sm:min-h-0 px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-base sm:text-sm bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:outline-none"
          >
            <option value="">All Genders</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
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
            <option value="">All Account Statuses</option>
            <option value="1">Active Account</option>
            <option value="0">Disabled Account</option>
          </select>

          <button
            onClick={fetchPatients}
            title="Refresh Registry" aria-label="Refresh registry"
            className="inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 p-2 border border-slate-300 dark:border-gray-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Table / State Views */}
      {loading && patients.length === 0 ? (
        <TableSkeleton
          rows={8}
          columns={['w-12', 'w-48', 'w-28', 'w-32', 'w-28', 'w-20', 'w-24']}
        />
      ) : (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
        {error ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto mb-3" />
            <p className="text-slate-800 dark:text-slate-100 font-medium">{error}</p>
            <button
              onClick={fetchPatients}
              className="mt-4 px-4 py-2 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center">
            <User className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
            <h3 className="text-slate-800 dark:text-slate-100 font-medium">No patient records found</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {search || genderFilter || statusFilter !== ''
                ? 'Try adjusting your search criteria or filters.'
                : 'Registered patients will appear here.'}
            </p>
          </div>
        ) : (
          <>
          <MobileSortControl sortBy={sortBy} sortDir={sortDir} onSort={handleSort} options={[{ value: 'name', label: 'Patient name' }, { value: 'date_of_birth', label: 'Date of birth' }, { value: 'is_active', label: 'Account status' }, { value: 'id', label: 'ID' }]} />
          <div className="overflow-x-auto">
            <table role="table" className="tch-responsive-table w-full text-left border-collapse">
              <thead role="rowgroup">
                <tr role="row" className="bg-slate-50/80 dark:bg-gray-900/50 border-b border-slate-200 dark:border-gray-700 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'id' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('id')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('id'); } }}>
                    <div className="flex items-center gap-1.5">
                      ID
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'name' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('name')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('name'); } }}>
                    <div className="flex items-center gap-1.5">
                      Patient Name & Email
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    </div>
                  </th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'date_of_birth' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('date_of_birth')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('date_of_birth'); } }}>
                    <div className="flex items-center gap-1.5">
                      DOB & Gender
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    </div>
                  </th>
                  <th role="columnheader" className="py-3.5 px-4">Contact Phone</th>
                  <th role="columnheader" className="py-3.5 px-4">Medical Alerts</th>
                  <th role="columnheader" tabIndex={0} aria-sort={sortBy === 'is_active' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'} className="py-3.5 px-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]" onClick={() => handleSort('is_active')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('is_active'); } }}>
                    <div className="flex items-center gap-1.5">
                      Account Status
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    </div>
                  </th>
                  <th role="columnheader" className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700 text-sm">
                {patients.map((patient) => (
                  <tr role="row" key={patient.id} className="hover:bg-slate-50/60 dark:hover:bg-gray-700/40 transition-colors">
                    <td role="cell" data-label="ID" className="py-3.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">#{patient.id}</td>
                    <td role="cell" data-label="Patient Name & Email" className="py-3.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-50">
                        {patient.first_name} {patient.last_name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        {patient.email}
                      </div>
                    </td>
                    <td role="cell" data-label="DOB & Gender" className="py-3.5 px-4">
                      <div className="text-slate-800 dark:text-slate-200 text-xs font-medium">{patient.date_of_birth}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                        {patient.gender ? patient.gender.toLowerCase().replace(/_/g, ' ') : 'Not specified'}
                      </div>
                    </td>
                    <td role="cell" data-label="Contact Phone" className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">{patient.phone}</td>
                    <td role="cell" data-label="Medical Alerts" className="py-3.5 px-4">
                      {patient.medical_alerts ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <HeartPulse className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                          Alerts Listed
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">None reported</span>
                      )}
                    </td>
                    <td role="cell" data-label="Account Status" className="py-3.5 px-4">
                      {patient.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300">
                          <XCircle className="w-3 h-3" />
                          Disabled
                        </span>
                      )}
                    </td>
                    <td role="cell" data-label="Actions" className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => openDetailsModal(patient)}
                        className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="View & Edit Patient"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStatusToggleClick(patient)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          patient.is_active
                            ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                            : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                        }`}
                        title={patient.is_active ? 'Disable Account' : 'Activate Account'}
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
          <div className="px-4 py-3 border-t border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing <span className="font-medium text-slate-700 dark:text-slate-200">{(meta.page - 1) * meta.per_page + 1}</span> to{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {Math.min(meta.page * meta.per_page, meta.total)}
              </span>{' '}
              of <span className="font-medium text-slate-700 dark:text-slate-200">{meta.total}</span> patients
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={meta.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-slate-700 dark:text-slate-200 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-gray-600"
              >
                Previous
              </button>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Page {meta.page} of {meta.last_page}
              </span>
              <button
                disabled={meta.page >= meta.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-slate-700 dark:text-slate-200 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-gray-600"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Patient View & Edit Modal */}
      {isModalOpen && selectedPatient && (
        <DialogOverlay
          onClose={() => setIsModalOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/65 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-slate-200 dark:border-gray-700 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/40">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded-lg">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                    Patient Profile #{selectedPatient.id}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Linked User ID #{selectedPatient.user_id} • Registered on{' '}
                    {selectedPatient.created_at?.split(' ')[0] || 'Unknown'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {formErrors.general && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm rounded-lg">
                  {formErrors.general}
                </div>
              )}

              {/* Patient Overview Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-gray-900/50 rounded-xl border border-slate-200 dark:border-gray-700 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Account Email:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100 break-all">{selectedPatient.email}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Account Status:</span>
                  <span
                    className={`font-semibold ${
                      selectedPatient.is_active ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {selectedPatient.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Total Bookings:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {selectedPatient.appointment_count ?? '0'} records
                  </span>
                </div>
              </div>

              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    First Name <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Last Name <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* DOB, Gender, Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Date of Birth <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Phone <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  placeholder="Street, Barangay, City, Province"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* Emergency Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Parent, Spouse, Guardian"
                    value={formData.emergency_contact_name}
                    onChange={(e) =>
                      setFormData({ ...formData, emergency_contact_name: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Emergency Contact Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="+63 917 000 0000"
                    value={formData.emergency_contact_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, emergency_contact_phone: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Medical Alerts Banner & Input */}
              <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/50 dark:bg-amber-950/30 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold text-xs">
                  <HeartPulse className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Clinical Medical Alerts, Allergies, or Systemic Conditions
                </div>
                <textarea
                  rows="2"
                  placeholder="e.g., Allergic to penicillin, Asthma, Hypertension, Bleeding diathesis, Diabetic on insulin..."
                  value={formData.medical_alerts}
                  onChange={(e) => setFormData({ ...formData, medical_alerts: e.target.value })}
                  className="w-full px-3.5 py-2 border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  These alerts appear prominently on dentist appointment screens and treatment records.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => handleStatusToggleClick(selectedPatient)}
                  className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                    selectedPatient.is_active
                      ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                      : 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                  }`}
                >
                  {selectedPatient.is_active ? 'Disable Account Login' : 'Enable Account Login'}
                </button>

                <div className="flex items-center gap-3">
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
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 dark:bg-[#0F766E] hover:bg-teal-700 dark:hover:bg-teal-600 text-white font-medium text-sm rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    {formSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Save Profile Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}

      {/* Confirmation Dialog */}
      {confirmModal.isOpen && confirmModal.patient && (
        <DialogOverlay
          onClose={() => setConfirmModal({ isOpen: false, patient: null, targetStatus: 0, submitting: false })} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/65 backdrop-blur-sm">
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
                  {confirmModal.targetStatus === 0 ? 'Disable Patient Account?' : 'Enable Patient Account?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {confirmModal.patient.first_name} {confirmModal.patient.last_name} (
                  {confirmModal.patient.email})
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmModal.targetStatus === 0
                ? 'Disabling this account will revoke login access and online booking privileges for this patient. All past clinical records, appointments, and diagnostic data will remain completely intact.'
                : 'Enabling this account will restore full access for the patient to log in and schedule appointments.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() =>
                  setConfirmModal({ isOpen: false, patient: null, targetStatus: 0, submitting: false })
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
                {confirmModal.targetStatus === 0 ? 'Confirm Disable' : 'Confirm Enable'}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}

export default PatientListPage;

