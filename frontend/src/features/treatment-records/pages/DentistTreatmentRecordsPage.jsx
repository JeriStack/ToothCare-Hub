import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Lock,
  Clock,
  User,
  Calendar,
  Eye,
  AlertTriangle,
  Stethoscope,
  X,
  Plus,
} from 'lucide-react';
import { treatmentRecordsApi } from '../api';
import { appointmentsApi } from '../../appointments/api';
import { TreatmentRecordViewer } from '../components/TreatmentRecordViewer';
import { TreatmentRecordEditor } from '../components/TreatmentRecordEditor';
import { TableSkeleton } from '../../../components/skeletons/TableSkeleton';
import { ServerTableFooter } from '../../../components/ui/ServerTableControls';

import { DialogOverlay } from '../../../components/ui/DialogOverlay';
export function DentistTreatmentRecordsPage() {
  const [records, setRecords] = useState([]);
  const [pendingVisits, setPendingVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 10, last_page: 1 });

  // Viewer / Editor modal state
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [documentingVisit, setDocumentingVisit] = useState(null);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, completedRes, documentedIndexRes] = await Promise.all([
        treatmentRecordsApi.list({
          page,
          per_page: perPage,
        }),
        appointmentsApi.listDentist({ status: 'COMPLETED', per_page: 50 }).catch(() => ({ items: [] })),
        page === 1 && perPage >= 100
          ? Promise.resolve(null)
          : treatmentRecordsApi.list({ page: 1, per_page: 100 }).catch(() => null),
      ]);
      const items = Array.isArray(data) ? data : data.items || [];
      const resMeta = data.meta || {
        total: items.length,
        page,
        per_page: perPage,
        last_page: Math.max(1, Math.ceil(items.length / perPage)),
      };
      setRecords(items);
      setMeta(resMeta);

      const completedItems = Array.isArray(completedRes) ? completedRes : completedRes?.items || [];
      const indexedItems = Array.isArray(documentedIndexRes)
        ? documentedIndexRes
        : documentedIndexRes?.items || items;
      const documentedApptIds = new Set([
        ...items.map((r) => Number(r.appointment_id)),
        ...indexedItems.map((r) => Number(r.appointment_id)),
      ]);
      setPendingVisits(
        completedItems.filter((a) => !a.has_treatment_record && !documentedApptIds.has(Number(a.id)))
      );
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load treatment records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [page, perPage]);

  const filteredRecords = records.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const patientName = `${r.patient_first_name || ''} ${r.patient_last_name || ''}`.toLowerCase();
    const serviceName = (r.service_name || '').toLowerCase();
    const diagnosis = (r.diagnosis || '').toLowerCase();
    const teeth = Array.isArray(r.teeth_treated) ? r.teeth_treated.join(' ') : '';
    return (
      patientName.includes(q) ||
      serviceName.includes(q) ||
      diagnosis.includes(q) ||
      teeth.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#12304A] dark:text-slate-100">Clinical Treatment Records</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Electronic health documentation, procedures, FDI odontograms, and prescription histories.
          </p>
        </div>
      </div>

      {/* Pending Clinical Documentation Panel (Completed visits missing procedure notes) */}
      {!loading && !error && pendingVisits.length > 0 && (
        <div className="bg-amber-50/75 dark:bg-amber-500/[0.08] rounded-2xl border border-amber-200/90 dark:border-amber-500/30 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                Completed Visits Awaiting Clinical Documentation ({pendingVisits.length})
              </h3>
            </div>
            <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
              Select a completed visit below to author procedure notes
            </span>
          </div>

          <div className="space-y-2">
            {pendingVisits.map((visit) => (
              <div
                key={visit.id}
                className="p-3.5 rounded-xl bg-white dark:bg-gray-800/95 border border-amber-200/70 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5 text-xs">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>#{visit.id}</span>
                    <span>
                      {visit.patient_first_name} {visit.patient_last_name}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{visit.service_name || 'Dental Visit'}</span>
                    {' · '}
                    <span className="tabular-nums">{visit.start_at ? visit.start_at.slice(0, 16) : 'Completed'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDocumentingVisit(visit)}
                  className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Document Now</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient, procedure, tooth"
            className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Records Table */}
      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/50 rounded-xl border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200">
          <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto mb-2" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            type="button"
            onClick={fetchRecords}
            className="mt-3 px-4 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700">
          <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">No treatment records found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'No treatment records match your search query.'
              : 'You have not authored any treatment records yet. Complete an appointment visit to document clinical findings.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table role="table" className="tch-responsive-table w-full text-left border-collapse">
              <thead role="rowgroup">
                <tr role="row" className="bg-slate-50/80 dark:bg-gray-900/60 border-b border-slate-200 dark:border-gray-700 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th role="columnheader" className="py-3 px-4">Record & Date</th>
                  <th role="columnheader" className="py-3 px-4">Patient</th>
                  <th role="columnheader" className="py-3 px-4">Service & Teeth Treated</th>
                  <th role="columnheader" className="py-3 px-4">Compliance Status</th>
                  <th role="columnheader" className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/70 text-xs">
                {filteredRecords.map((rec) => {
                  const isLocked = Boolean(rec.is_locked);
                  const teeth = Array.isArray(rec.teeth_treated) ? rec.teeth_treated : [];

                  return (
                    <tr role="row"
                      key={rec.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-gray-700/40 transition-colors group cursor-pointer"
                      onClick={() => {
                        setSelectedRecord(rec);
                        setIsEditingModal(false);
                      }}
                    >
                      {/* ID and Date */}
                      <td role="cell" data-label="Record & Date" className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-slate-100">#TR-{rec.id}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          <span>{rec.created_at ? rec.created_at.slice(0, 16) : 'N/A'}</span>
                        </div>
                      </td>

                      {/* Patient */}
                      <td role="cell" data-label="Patient" className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          <span>
                            {rec.patient_first_name} {rec.patient_last_name}
                          </span>
                        </div>
                        {rec.patient_medical_alerts && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
                              ⚠️ {rec.patient_medical_alerts}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Service and Teeth */}
                      <td role="cell" data-label="Service & Teeth Treated" className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{rec.service_name || 'Dental Service'}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {teeth.length === 0 ? (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">Full mouth</span>
                          ) : (
                            teeth.map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/70"
                              >
                                #{t}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Compliance Status */}
                      <td role="cell" data-label="Compliance Status" className="py-3 px-4 whitespace-nowrap">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-gray-600">
                            <Lock className="w-3 h-3 text-slate-400 dark:text-slate-400" />
                            Archived
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800/70">
                            <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                            24h Editable
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td role="cell" data-label="Action" className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecord(rec);
                            setIsEditingModal(false);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0F766E] dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/70 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Chart</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ServerTableFooter
            page={meta.current_page || meta.page || page}
            perPage={meta.per_page || perPage}
            totalRecords={meta.total_records ?? meta.total ?? filteredRecords.length}
            filteredRecords={searchQuery.trim() ? filteredRecords.length : (meta.filtered_records ?? meta.total ?? filteredRecords.length)}
            totalPages={meta.total_pages || meta.last_page || 1}
            onPageChange={(nextPage) => setPage(nextPage)}
            onPerPageChange={(nextSize) => {
              setPerPage(nextSize);
              setPage(1);
            }}
            pageSizeOptions={[5, 10, 15, 25, 50]}
            loading={loading}
            itemLabel="records"
          />
        </div>
      )}

      {/* Detail / Chart Modal */}
      {selectedRecord && (
        <DialogOverlay
          onClose={() => setSelectedRecord(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs overflow-y-auto"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-2xl max-w-3xl w-full my-8 max-h-[90dvh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Clinical Record #{selectedRecord.id}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {isEditingModal ? (
                <TreatmentRecordEditor
                  appointmentId={selectedRecord.appointment_id}
                  initialRecord={selectedRecord}
                  onSaved={(updated) => {
                    setSelectedRecord(updated);
                    setIsEditingModal(false);
                    fetchRecords();
                  }}
                  onCancel={() => setIsEditingModal(false)}
                />
              ) : (
                <TreatmentRecordViewer
                  record={selectedRecord}
                  canEdit={true}
                  onEdit={() => setIsEditingModal(true)}
                />
              )}
            </div>
          </div>
        </DialogOverlay>
      )}
      {/* New Clinical Record Creation Modal for Completed Visits */}
      {documentingVisit && (
        <DialogOverlay
          onClose={() => setDocumentingVisit(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs overflow-y-auto"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-2xl max-w-3xl w-full my-8 max-h-[90dvh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>
                  Document Visit #{documentingVisit.id} — {documentingVisit.patient_first_name} {documentingVisit.patient_last_name}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setDocumentingVisit(null)}
                aria-label="Close clinical record editor"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              <TreatmentRecordEditor
                appointmentId={documentingVisit.id}
                onSaved={() => {
                  setDocumentingVisit(null);
                  fetchRecords();
                }}
                onCancel={() => setDocumentingVisit(null)}
              />
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}
