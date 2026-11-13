import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  Lock,
  Clock,
  Save,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { FdiTeethSelector } from './FdiTeethSelector';
import { treatmentRecordsApi } from '../api';

export function TreatmentRecordEditor({
  appointmentId,
  initialRecord = null,
  onSaved,
  onCancel,
  isReadOnly = false,
}) {
  const isEditing = Boolean(initialRecord?.id);

  // Form State
  const [teethTreated, setTeethTreated] = useState(
    Array.isArray(initialRecord?.teeth_treated) ? initialRecord.teeth_treated : []
  );
  const [diagnosis, setDiagnosis] = useState(initialRecord?.diagnosis || '');
  const [procedureNotes, setProcedureNotes] = useState(initialRecord?.procedure_notes || '');
  const [prescriptionNotes, setPrescriptionNotes] = useState(initialRecord?.prescription_notes || '');
  const [homeCareAdvice, setHomeCareAdvice] = useState(initialRecord?.home_care_advice || '');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // 24-hour compliance lock calculation
  const isLocked = Boolean(initialRecord?.is_locked);
  const [remainingTimeText, setRemainingTimeText] = useState('');

  useEffect(() => {
    if (!initialRecord?.locked_at || isLocked) return;

    const calculateRemaining = () => {
      const lockDate = new Date(initialRecord.locked_at.replace(' ', 'T') + '+08:00');
      const now = new Date();
      const diffMs = lockDate.getTime() - now.getTime();

      if (diffMs <= 0) {
        setRemainingTimeText('Locked (Window Expired)');
        return;
      }

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setRemainingTimeText(`${hours}h ${minutes}m remaining to edit`);
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 60000);
    return () => clearInterval(interval);
  }, [initialRecord?.locked_at, isLocked]);

  const disabled = isReadOnly || isLocked || submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setHasInteracted(true);
    setFormError(null);

    // Validation
    const cleanDiagnosis = diagnosis.trim();
    const cleanProcedure = procedureNotes.trim();

    if (cleanDiagnosis.length < 3) {
      setFormError('Clinical diagnosis is required (minimum 3 characters).');
      return;
    }
    if (cleanProcedure.length < 5) {
      setFormError('Detailed procedure notes are required (minimum 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      let savedRecord;
      if (isEditing) {
        savedRecord = await treatmentRecordsApi.update(initialRecord.id, {
          diagnosis: cleanDiagnosis,
          procedure_notes: cleanProcedure,
          prescription_notes: prescriptionNotes.trim() || null,
          home_care_advice: homeCareAdvice.trim() || null,
          teeth_treated: teethTreated,
        });
        setFormSuccess('Treatment record updated successfully.');
      } else {
        savedRecord = await treatmentRecordsApi.create({
          appointment_id: Number(appointmentId),
          diagnosis: cleanDiagnosis,
          procedure_notes: cleanProcedure,
          prescription_notes: prescriptionNotes.trim() || null,
          home_care_advice: homeCareAdvice.trim() || null,
          teeth_treated: teethTreated,
        });
        setFormSuccess('Clinical treatment record created and attached to appointment.');
      }

      if (onSaved) {
        setTimeout(() => {
          onSaved(savedRecord);
        }, 600);
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to save treatment record.';
      setFormError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* 24-Hour Compliance Notice */}
      {isLocked ? (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
        >
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-amber-950 dark:text-amber-100">Record Locked & Permanently Archived</p>
            <p className="mt-0.5 text-amber-800 dark:text-amber-300">
              The 24-hour compliance edit window for this clinical record has concluded. In accordance with clinical audit and legal charting standards, this record cannot be modified.
            </p>
          </div>
        </div>
      ) : isEditing ? (
        <div className="flex items-center justify-between p-3 rounded-lg bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800 text-teal-900 dark:text-teal-200 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <span>
              <strong>Compliance Edit Window Active:</strong> {remainingTimeText || '24 hours from creation.'}
            </span>
          </div>
          <span className="text-[11px] text-teal-700 dark:text-teal-200 bg-teal-100/80 dark:bg-teal-900/60 px-2 py-0.5 rounded-full font-medium">
            Editable
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 text-xs">
          <HelpCircle className="w-4 h-4 text-slate-400 dark:text-gray-400 mt-0.5 shrink-0" />
          <div>
            <strong className="dark:text-gray-100">Clinical Audit Policy:</strong> Once created, treatment records may be amended for up to 24 hours. After 24 hours, records are automatically sealed and immutable.
          </div>
        </div>
      )}

      {/* Error or Success Alerts */}
      {formError && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium"
        >
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {formSuccess && (
        <div
          role="status"
          className="flex items-center gap-2 p-3 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs font-medium"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* FDI Teeth Notation Chart */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300">
          Treated Teeth / Odontogram (FDI 2-Digit Notation)
        </label>
        <FdiTeethSelector
          selectedTeeth={teethTreated}
          onChange={setTeethTreated}
          readOnly={disabled}
        />
      </div>

      {/* Diagnosis Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="tr-diagnosis" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-200">
            Clinical Diagnosis <span className="text-rose-500 dark:text-rose-400">*</span>
          </label>
          <span className="text-[11px] text-slate-400 dark:text-gray-400">{diagnosis.length}/2000 chars</span>
        </div>
        <textarea
          id="tr-diagnosis"
          name="diagnosis"
          rows={3}
          required
          disabled={disabled}
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="e.g. Moderate chronic marginal periodontitis with localized calculus deposits on mandibular anterior teeth."
          className={`w-full rounded-lg border text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400 ${
            hasInteracted && diagnosis.trim().length < 3
              ? 'border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/30'
              : 'border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 hover:border-slate-400 dark:hover:border-gray-500'
          } ${disabled ? 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 cursor-not-allowed' : ''}`}
        />
        {hasInteracted && diagnosis.trim().length < 3 && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">Please enter a valid clinical diagnosis (min 3 characters).</p>
        )}
      </div>

      {/* Procedure Notes Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="tr-procedure" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-200">
            Procedure Notes & Operative Details <span className="text-rose-500 dark:text-rose-400">*</span>
          </label>
          <span className="text-[11px] text-slate-400 dark:text-gray-400">{procedureNotes.length}/5000 chars</span>
        </div>
        <textarea
          id="tr-procedure"
          name="procedure_notes"
          rows={5}
          required
          disabled={disabled}
          value={procedureNotes}
          onChange={(e) => setProcedureNotes(e.target.value)}
          placeholder="e.g. Ultrasonic scaling and root planing performed with subgingival curettage. Hemostasis achieved with sterile gauze. Polished with fine pumice paste."
          className={`w-full rounded-lg border text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400 ${
            hasInteracted && procedureNotes.trim().length < 5
              ? 'border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/30'
              : 'border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 hover:border-slate-400 dark:hover:border-gray-500'
          } ${disabled ? 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 cursor-not-allowed' : ''}`}
        />
        {hasInteracted && procedureNotes.trim().length < 5 && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">Please provide detailed procedure notes (min 5 characters).</p>
        )}
      </div>

      {/* Prescription Notes */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="tr-prescription" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-200">
            Prescriptions & Pharmacotherapy (Optional)
          </label>
          <span className="text-[11px] text-slate-400 dark:text-gray-400">{prescriptionNotes.length}/2000 chars</span>
        </div>
        <textarea
          id="tr-prescription"
          name="prescription_notes"
          rows={2}
          disabled={disabled}
          value={prescriptionNotes}
          onChange={(e) => setPrescriptionNotes(e.target.value)}
          placeholder="e.g. Chlorhexidine 0.12% oral rinse 15ml bid for 7 days. Mefenamic acid 500mg tid prn."
          className={`w-full rounded-lg border border-slate-300 dark:border-gray-600 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 p-3 focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400 ${
            disabled ? 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-900'
          }`}
        />
      </div>

      {/* Home Care Advice */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="tr-homecare" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-200">
            Home Care & Patient Post-Op Advice (Optional)
          </label>
          <span className="text-[11px] text-slate-400 dark:text-gray-400">{homeCareAdvice.length}/2000 chars</span>
        </div>
        <textarea
          id="tr-homecare"
          name="home_care_advice"
          rows={2}
          disabled={disabled}
          value={homeCareAdvice}
          onChange={(e) => setHomeCareAdvice(e.target.value)}
          placeholder="e.g. Avoid smoking and warm food for 24h. Use soft-bristled toothbrush. Return if bleeding persists."
          className={`w-full rounded-lg border border-slate-300 dark:border-gray-600 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 p-3 focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400 ${
            disabled ? 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-900'
          }`}
        />
      </div>

      {/* Form Action Controls */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-gray-700">
        {onCancel && (
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-gray-200 hover:text-slate-800 dark:hover:text-white bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        )}

        {!isLocked && !isReadOnly && (
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#0F766E] dark:bg-[#0F766E] dark:hover:bg-[#0D9488] rounded-lg shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Saving Clinical Record...' : isEditing ? 'Update Treatment Record' : 'Save Treatment Record'}</span>
          </button>
        )}
      </div>
    </form>
  );
}
