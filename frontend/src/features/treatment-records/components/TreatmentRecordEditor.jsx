import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Clock,
  Save,
  CheckCircle2,
  XCircle,
  Shield,
  Sparkles,
} from 'lucide-react';
import { FdiTeethSelector } from './FdiTeethSelector';
import { treatmentRecordsApi } from '../api';

const CLINICAL_TEMPLATES = [
  {
    id: 'prophylaxis',
    label: 'Oral Prophylaxis',
    diagnosis: 'Generalized mild supragingival plaque and calculus deposits.',
    procedure_notes:
      'Completed full-mouth ultrasonic scaling, subgingival debridement as indicated, and coronal polishing with fine prophylaxis paste. Gingival tissues inspected with minimal bleeding.',
    prescription_notes: '',
    home_care_advice:
      'Brush twice daily with fluoride toothpaste using a soft-bristled brush, floss nightly, and return in 6 months for routine recall.',
  },
  {
    id: 'composite',
    label: 'Composite Filling',
    diagnosis: 'Localized dental caries requiring direct composite restoration.',
    procedure_notes:
      'Isolated target tooth, removed carious dentin/enamel, etched and bonded cavity preparation, placed incremental nanohybrid composite resin, light-cured, adjusted occlusion, and finished/polished margins.',
    prescription_notes: '',
    home_care_advice:
      'Avoid biting hard foods on the restored tooth for 24 hours. Mild cold sensitivity may occur for a few days; contact the clinic if bite feels high.',
  },
  {
    id: 'extraction',
    label: 'Tooth Extraction',
    diagnosis: 'Non-restorable tooth indicated for simple extraction.',
    procedure_notes:
      'Administered local anesthesia, achieved profound numbness, performed atraumatic elevation and forceps extraction intact, curetted socket, irrigated with sterile saline, and achieved hemostasis with gauze pack.',
    prescription_notes: 'Mefenamic acid 500mg PO q8h PRN pain for 3 days (if no contraindications).',
    home_care_advice:
      'Bite firmly on gauze for 30–45 minutes. Avoid rinsing, spitting, straws, hot drinks, and smoking for 24 hours. Apply cold compress intermittently if swelling occurs.',
  },
  {
    id: 'endodontics',
    label: 'Root Canal Therapy',
    diagnosis: 'Irreversible pulpitis / apical periodontitis requiring endodontic therapy.',
    procedure_notes:
      'Administered local anesthesia, placed rubber dam isolation, completed access cavity, extirpated pulp, determined working length, instrumented and irrigated canals with NaOCl/saline, dried canals, and placed intracanal medicament / obturation with temporary coronal seal.',
    prescription_notes: 'Ibuprofen 400mg PO q6-8h PRN post-endodontic discomfort (if no contraindications).',
    home_care_advice:
      'Avoid chewing hard foods on the treated tooth until permanent restoration is placed. Maintain gentle oral hygiene and return for scheduled follow-up.',
  },
];

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
  const alertRef = useRef(null);

  const showError = (message) => {
    setFormError(message);
    window.requestAnimationFrame?.(() => {
      const el = alertRef.current;
      if (!el) return;
      el.scrollIntoView?.({ block: 'nearest' });
      el.focus?.({ preventScroll: true });
    });
  };

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

  const applyTemplate = (tpl) => {
    if (disabled) return;
    setDiagnosis(tpl.diagnosis);
    setProcedureNotes(tpl.procedure_notes);
    setPrescriptionNotes(tpl.prescription_notes);
    setHomeCareAdvice(tpl.home_care_advice);
    if (formError) setFormError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setHasInteracted(true);
    setFormError(null);

    const cleanDiagnosis = diagnosis.trim();
    const cleanProcedure = procedureNotes.trim();

    if (cleanDiagnosis.length < 3) {
      showError('Clinical diagnosis is required (minimum 3 characters).');
      return;
    }
    if (cleanProcedure.length < 5) {
      showError('Detailed procedure notes are required (minimum 5 characters).');
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
      showError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* 24-Hour Compliance Notice */}
      {isLocked ? (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200"
        >
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-xs space-y-0.5">
            <p className="font-semibold text-amber-950 dark:text-amber-100">Record Locked &amp; Permanently Archived</p>
            <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
              The 24-hour edit window has closed. This record is sealed for clinical audit compliance.
            </p>
          </div>
        </div>
      ) : isEditing ? (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-teal-50/80 dark:bg-teal-500/10 border border-teal-200/80 dark:border-teal-500/25 text-teal-900 dark:text-teal-200 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
            <span>
              <strong>Edit Window Active:</strong> {remainingTimeText || '24 hours from creation.'}
            </span>
          </div>
          <span className="text-[11px] text-teal-700 dark:text-teal-200 bg-teal-100/80 dark:bg-teal-900/60 px-2.5 py-0.5 rounded-full font-semibold">
            Editable
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-50/80 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-700/80 text-slate-600 dark:text-slate-300 text-xs">
          <Shield className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
          <span>Records remain editable for 24 hours after saving, then seal automatically for audit compliance.</span>
        </div>
      )}

      {/* FDI Teeth Notation Chart */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Treated Teeth (FDI Odontogram)
        </label>
        <FdiTeethSelector
          selectedTeeth={teethTreated}
          onChange={setTeethTreated}
          readOnly={disabled}
        />
      </div>

      {/* Quick Procedure Templates (Create Mode) */}
      {!isEditing && !disabled && (
        <div className="p-3.5 rounded-xl bg-slate-50/75 dark:bg-gray-900/50 border border-slate-200/80 dark:border-gray-700/80 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
            <span>Quick Clinical Templates (Prefill &amp; Customize)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CLINICAL_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-200 hover:border-teal-400 dark:hover:border-teal-500 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer"
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Diagnosis & Procedure Notes */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="tr-diagnosis" className="block min-w-0 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Clinical Diagnosis <span className="text-rose-500 dark:text-rose-400">*</span>
            </label>
            <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
              {diagnosis.length} / 2,000
            </span>
          </div>
          <textarea
            id="tr-diagnosis"
            aria-invalid={hasInteracted && diagnosis.trim().length < 3}
            name="diagnosis"
            rows={3}
            maxLength={2000}
            required
            disabled={disabled}
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="e.g. Moderate chronic marginal periodontitis with localized calculus deposits."
            className={`w-full rounded-xl border text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 ${
              hasInteracted && diagnosis.trim().length < 3
                ? 'border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/30'
                : 'border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900/70 hover:border-slate-400 dark:hover:border-gray-500'
            } ${disabled ? 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 cursor-not-allowed' : ''}`}
          />
          {hasInteracted && diagnosis.trim().length < 3 && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
              Please enter a valid clinical diagnosis (min 3 characters).
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="tr-procedure" className="block min-w-0 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Procedure Notes &amp; Operative Details <span className="text-rose-500 dark:text-rose-400">*</span>
            </label>
            <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
              {procedureNotes.length} / 5,000
            </span>
          </div>
          <textarea
            id="tr-procedure"
            aria-invalid={hasInteracted && procedureNotes.trim().length < 5}
            name="procedure_notes"
            rows={4}
            maxLength={5000}
            required
            disabled={disabled}
            value={procedureNotes}
            onChange={(e) => setProcedureNotes(e.target.value)}
            placeholder="e.g. Ultrasonic scaling performed with subgingival curettage and fine pumice polish."
            className={`w-full rounded-xl border text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 ${
              hasInteracted && procedureNotes.trim().length < 5
                ? 'border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/30'
                : 'border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900/70 hover:border-slate-400 dark:hover:border-gray-500'
            } ${disabled ? 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 cursor-not-allowed' : ''}`}
          />
          {hasInteracted && procedureNotes.trim().length < 5 && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
              Please provide detailed procedure notes (min 5 characters).
            </p>
          )}
        </div>

        {/* Optional Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="tr-prescription" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                <span>Prescriptions</span>
                <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">
                  Optional
                </span>
              </label>
              <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                {prescriptionNotes.length} / 2,000
              </span>
            </div>
            <textarea
              id="tr-prescription"
              name="prescription_notes"
              rows={3}
              maxLength={2000}
              disabled={disabled}
              value={prescriptionNotes}
              onChange={(e) => setPrescriptionNotes(e.target.value)}
              placeholder="e.g. Chlorhexidine 0.12% rinse 15ml bid x 7d."
              className={`w-full rounded-xl border border-slate-300 dark:border-gray-600 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 p-3 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 ${
                disabled ? 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-900/70'
              }`}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="tr-homecare" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                <span>Post-Op &amp; Home Care</span>
                <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">
                  Optional
                </span>
              </label>
              <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                {homeCareAdvice.length} / 2,000
              </span>
            </div>
            <textarea
              id="tr-homecare"
              name="home_care_advice"
              rows={3}
              maxLength={2000}
              disabled={disabled}
              value={homeCareAdvice}
              onChange={(e) => setHomeCareAdvice(e.target.value)}
              placeholder="e.g. Avoid hot drinks for 24h. Use soft-bristled toothbrush."
              className={`w-full rounded-xl border border-slate-300 dark:border-gray-600 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 p-3 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 ${
                disabled ? 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-900/70'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Error or Success Alerts */}
      {formError && (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      {formSuccess && (
        <div
          role="status"
          className="flex items-center gap-2 p-3 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs font-medium"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* Form Action Controls */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-3 border-t border-slate-200 dark:border-gray-700 [&>button]:min-h-11 sm:[&>button]:min-h-10 [&>button]:w-full sm:[&>button]:w-auto [&>button]:justify-center">
        {onCancel && (
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-gray-200 hover:text-slate-800 dark:hover:text-white bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}

        {!isLocked && !isReadOnly && (
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#0F766E] dark:bg-[#0F766E] dark:hover:bg-[#0D9488] rounded-xl shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{submitting ? 'Saving Clinical Record...' : isEditing ? 'Update Treatment Record' : 'Save Treatment Record'}</span>
          </button>
        )}
      </div>
    </form>
  );
}
