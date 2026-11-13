import React from 'react';
import {
  FileText,
  Lock,
  Clock,
  Edit3,
  Stethoscope,
  Pill,
  HeartPulse,
  AlertTriangle,
  User,
  Calendar,
  CheckCircle2,
  Printer,
} from 'lucide-react';
import { getToothDescription } from './FdiTeethSelector';

export function TreatmentRecordViewer({
  record,
  onEdit,
  canEdit = false,
}) {
  if (!record) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-gray-800/70 rounded-xl border border-slate-200 dark:border-gray-700">
        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-medium">No treatment record has been documented for this visit yet.</p>
      </div>
    );
  }

  const isLocked = Boolean(record.is_locked);
  const teethList = Array.isArray(record.teeth_treated) ? record.teeth_treated : [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Chart Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-teal-50/40 dark:from-gray-800 dark:to-teal-950/30 border-b border-slate-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0D9488]/15 dark:bg-teal-900/60 border border-[#0D9488]/30 dark:border-teal-800 flex items-center justify-center text-[#0F766E] dark:text-teal-300">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#12304A] dark:text-slate-100">
                Treatment Record #{record.id}
              </h3>
              {isLocked ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-gray-600">
                  <Lock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  Archived & Sealed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                  <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                  24h Edit Window Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Documented on {record.created_at || 'Recently'} • Service: {record.service_name || 'Clinical Care'}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            title="Print Clinical Summary"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-200 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-600 transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>

          {canEdit && !isLocked && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] transition-colors shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Record</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Clinician & Patient Metadata Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Attending Clinician */}
          <div className="p-3.5 rounded-lg bg-slate-50/70 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-700 text-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
              Attending Clinician
            </span>
            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Dr. {record.dentist_first_name} {record.dentist_last_name}
            </p>
            <p className="text-slate-600 dark:text-slate-300">{record.dentist_specialization || 'Dental Practitioner'}</p>
            <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              PRC License: {record.dentist_license_number || 'Registered'}
            </p>
          </div>

          {/* Patient Details */}
          <div className="p-3.5 rounded-lg bg-slate-50/70 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-700 text-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
              Patient Information
            </span>
            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {record.patient_first_name} {record.patient_last_name}
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              DOB: {record.patient_date_of_birth || 'N/A'} • Gender: {record.patient_gender || 'Unspecified'}
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Contact: {record.patient_phone || 'N/A'}
            </p>
          </div>
        </div>

        {/* Medical Alerts (if present) */}
        {record.patient_medical_alerts && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Medical Alerts / Allergies:</span>{' '}
              {record.patient_medical_alerts}
            </div>
          </div>
        )}

        {/* Teeth Treated (FDI Notation) */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Treated Teeth / Odontogram Chart (FDI)
          </h4>
          {teethList.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-gray-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-gray-700">
              General full-mouth or non-tooth-specific oral procedure.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {teethList.map((t) => (
                <div
                  key={t}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-teal-50 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200 border border-teal-200/90 dark:border-teal-800 shadow-2xs"
                  title={getToothDescription(Number(t))}
                >
                  <span className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400" aria-hidden="true" />
                  <span>Tooth #{t}</span>
                  <span className="text-[10px] font-normal text-teal-600 dark:text-teal-300 hidden sm:inline">
                    ({getToothDescription(Number(t)).split('—')[1]?.trim()})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Diagnosis */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <HeartPulse className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            Clinical Diagnosis
          </h4>
          <div className="p-3.5 rounded-lg bg-slate-50/80 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 text-sm whitespace-pre-line leading-relaxed">
            {record.diagnosis}
          </div>
        </div>

        {/* Procedure Notes */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            Operative Procedure & Treatment Notes
          </h4>
          <div className="p-3.5 rounded-lg bg-slate-50/80 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 text-sm whitespace-pre-line leading-relaxed font-sans">
            {record.procedure_notes}
          </div>
        </div>

        {/* Prescriptions */}
        {record.prescription_notes && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Pill className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Prescriptions & Pharmacotherapy
            </h4>
            <div className="p-3.5 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/35 border border-emerald-200/60 dark:border-emerald-800/70 text-emerald-950 dark:text-emerald-100 text-sm whitespace-pre-line leading-relaxed">
              {record.prescription_notes}
            </div>
          </div>
        )}

        {/* Home Care Advice */}
        {record.home_care_advice && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Post-Op Home Care & Patient Advice
            </h4>
            <div className="p-3.5 rounded-lg bg-sky-50/40 dark:bg-sky-950/35 border border-sky-200/60 dark:border-sky-800/70 text-sky-950 dark:text-sky-100 text-sm whitespace-pre-line leading-relaxed">
              {record.home_care_advice}
            </div>
          </div>
        )}

        {/* Legal & Compliance Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <span>
            ToothCare Hub Certified Electronic Health Record (EHR) • ISO 3950 FDI Compliant
          </span>
          <span>
            {isLocked
              ? `Locked at: ${record.locked_at || 'Archived'}`
              : `Auto-lock scheduled: ${record.locked_at || '24 hours'}`}
          </span>
        </div>
      </div>
    </div>
  );
}
