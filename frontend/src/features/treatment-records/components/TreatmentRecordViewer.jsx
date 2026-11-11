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
      <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Chart Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-teal-50/40 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0D9488]/15 border border-[#0D9488]/30 flex items-center justify-center text-[#0F766E]">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#12304A]">
                Treatment Record #{record.id}
              </h3>
              {isLocked ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                  <Lock className="w-3 h-3 text-slate-500" />
                  Archived & Sealed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-300">
                  <Clock className="w-3 h-3 text-teal-600" />
                  24h Edit Window Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>

          {canEdit && !isLocked && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#0F766E] transition-colors shadow-xs"
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
          <div className="p-3.5 rounded-lg bg-slate-50/70 border border-slate-200/80 text-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Attending Clinician
            </span>
            <p className="font-semibold text-slate-900 text-sm">
              Dr. {record.dentist_first_name} {record.dentist_last_name}
            </p>
            <p className="text-slate-600">{record.dentist_specialization || 'Dental Practitioner'}</p>
            <p className="text-slate-500 font-mono text-[11px]">
              PRC License: {record.dentist_license_number || 'Registered'}
            </p>
          </div>

          {/* Patient Details */}
          <div className="p-3.5 rounded-lg bg-slate-50/70 border border-slate-200/80 text-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Patient Information
            </span>
            <p className="font-semibold text-slate-900 text-sm">
              {record.patient_first_name} {record.patient_last_name}
            </p>
            <p className="text-slate-600">
              DOB: {record.patient_date_of_birth || 'N/A'} • Gender: {record.patient_gender || 'Unspecified'}
            </p>
            <p className="text-slate-500">
              Contact: {record.patient_phone || 'N/A'}
            </p>
          </div>
        </div>

        {/* Medical Alerts (if present) */}
        {record.patient_medical_alerts && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Medical Alerts / Allergies:</span>{' '}
              {record.patient_medical_alerts}
            </div>
          </div>
        )}

        {/* Teeth Treated (FDI Notation) */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Treated Teeth / Odontogram Chart (FDI)
          </h4>
          {teethList.length === 0 ? (
            <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              General full-mouth or non-tooth-specific oral procedure.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {teethList.map((t) => (
                <div
                  key={t}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200/90 shadow-2xs"
                  title={getToothDescription(Number(t))}
                >
                  <span className="w-2 h-2 rounded-full bg-teal-500" aria-hidden="true" />
                  <span>Tooth #{t}</span>
                  <span className="text-[10px] font-normal text-teal-600 hidden sm:inline">
                    ({getToothDescription(Number(t)).split('—')[1]?.trim()})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Diagnosis */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <HeartPulse className="w-4 h-4 text-teal-600" />
            Clinical Diagnosis
          </h4>
          <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200 text-slate-800 text-sm whitespace-pre-line leading-relaxed">
            {record.diagnosis}
          </div>
        </div>

        {/* Procedure Notes */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Stethoscope className="w-4 h-4 text-teal-600" />
            Operative Procedure & Treatment Notes
          </h4>
          <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200 text-slate-800 text-sm whitespace-pre-line leading-relaxed font-sans">
            {record.procedure_notes}
          </div>
        </div>

        {/* Prescriptions */}
        {record.prescription_notes && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Pill className="w-4 h-4 text-emerald-600" />
              Prescriptions & Pharmacotherapy
            </h4>
            <div className="p-3.5 rounded-lg bg-emerald-50/40 border border-emerald-200/60 text-emerald-950 text-sm whitespace-pre-line leading-relaxed">
              {record.prescription_notes}
            </div>
          </div>
        )}

        {/* Home Care Advice */}
        {record.home_care_advice && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-sky-600" />
              Post-Op Home Care & Patient Advice
            </h4>
            <div className="p-3.5 rounded-lg bg-sky-50/40 border border-sky-200/60 text-sky-950 text-sm whitespace-pre-line leading-relaxed">
              {record.home_care_advice}
            </div>
          </div>
        )}

        {/* Legal & Compliance Footer */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
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
