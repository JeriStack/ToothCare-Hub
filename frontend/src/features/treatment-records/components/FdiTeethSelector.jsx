import React from 'react';
import { X, Check } from 'lucide-react';

/**
 * FDI World Dental Federation Two-Digit Notation (ISO 3950)
 * Quadrant 1: Upper Right (18 to 11)
 * Quadrant 2: Upper Left (21 to 28)
 * Quadrant 3: Lower Left (38 to 31)
 * Quadrant 4: Lower Right (41 to 48)
 */
const QUADRANT_1 = [18, 17, 16, 15, 14, 13, 12, 11];
const QUADRANT_2 = [21, 22, 23, 24, 25, 26, 27, 28];
const QUADRANT_4 = [48, 47, 46, 45, 44, 43, 42, 41];
const QUADRANT_3 = [31, 32, 33, 34, 35, 36, 37, 38];
const UPPER_ARCH = [...QUADRANT_1, ...QUADRANT_2];
const LOWER_ARCH = [...QUADRANT_4, ...QUADRANT_3];
const FULL_MOUTH = [...UPPER_ARCH, ...LOWER_ARCH];

const TOOTH_NAMES = {
  1: 'Central Incisor',
  2: 'Lateral Incisor',
  3: 'Canine (Cuspid)',
  4: '1st Premolar (Bicuspid)',
  5: '2nd Premolar (Bicuspid)',
  6: '1st Molar (6-yr)',
  7: '2nd Molar (12-yr)',
  8: '3rd Molar (Wisdom)',
};

export function getToothDescription(toothNum) {
  const q = Math.floor(toothNum / 10);
  const pos = toothNum % 10;
  const quadrantNames = {
    1: 'Upper Right (Maxillary)',
    2: 'Upper Left (Maxillary)',
    3: 'Lower Left (Mandibular)',
    4: 'Lower Right (Mandibular)',
  };
  return `${quadrantNames[q] || 'Tooth'} ${toothNum} — ${TOOTH_NAMES[pos] || 'Tooth'}`;
}

export function FdiTeethSelector({
  selectedTeeth = [],
  onChange,
  readOnly = false,
}) {
  const selectedSet = new Set(selectedTeeth.map(Number));

  const toggleTooth = (tooth) => {
    if (readOnly) return;
    const next = new Set(selectedSet);
    if (next.has(tooth)) {
      next.delete(tooth);
    } else {
      next.add(tooth);
    }
    onChange(Array.from(next).sort((a, b) => a - b));
  };

  const toggleGroup = (teethGroup) => {
    if (readOnly) return;
    const allSelected = teethGroup.every((t) => selectedSet.has(t));
    const next = new Set(selectedSet);
    if (allSelected) {
      teethGroup.forEach((t) => next.delete(t));
    } else {
      teethGroup.forEach((t) => next.add(t));
    }
    onChange(Array.from(next).sort((a, b) => a - b));
  };

  const clearAll = () => {
    if (readOnly) return;
    onChange([]);
  };

  const isUpperSelected = UPPER_ARCH.every((t) => selectedSet.has(t));
  const isLowerSelected = LOWER_ARCH.every((t) => selectedSet.has(t));
  const isFullSelected = FULL_MOUTH.every((t) => selectedSet.has(t));

  const renderToothButton = (tooth) => {
    const isSelected = selectedSet.has(tooth);
    return (
      <button
        key={tooth}
        type="button"
        disabled={readOnly}
        onClick={() => toggleTooth(tooth)}
        aria-pressed={isSelected}
        title={getToothDescription(tooth)}
        className={`w-full min-h-11 rounded-lg text-xs font-semibold tabular-nums flex flex-col items-center justify-center transition-all ${
          isSelected
            ? 'bg-[#0D9488] text-white border-2 border-[#0F766E] dark:border-teal-300 shadow-xs ring-2 ring-[#0D9488]/25 dark:ring-teal-400/30 cursor-pointer'
            : readOnly
            ? 'bg-slate-100 dark:bg-gray-700/70 text-slate-400 dark:text-gray-400 border border-slate-200 dark:border-gray-600 cursor-not-allowed opacity-60'
            : 'bg-white dark:bg-gray-800/90 text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-700 hover:border-teal-400 dark:hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-500/15 hover:text-teal-900 dark:hover:text-teal-200 cursor-pointer'
        }`}
      >
        <span>{tooth}</span>
        {isSelected && <Check className="w-2.5 h-2.5 mt-0.5" aria-hidden="true" />}
      </button>
    );
  };

  const renderQuadrantHeader = (label, teethGroup, alignRight = false, tone = 'teal') => {
    const allInQ = teethGroup.every((t) => selectedSet.has(t));
    const colorClass =
      tone === 'teal'
        ? 'text-teal-800/90 dark:text-teal-300/90 hover:text-teal-700 dark:hover:text-teal-200'
        : 'text-sky-800/90 dark:text-sky-300/90 hover:text-sky-700 dark:hover:text-sky-200';
    return (
      <div className={`flex items-center ${alignRight ? 'lg:justify-end' : 'justify-start'}`}>
        {readOnly ? (
          <span className={`text-[10.5px] font-bold uppercase tracking-wide ${colorClass}`}>
            {label}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => toggleGroup(teethGroup)}
            aria-pressed={allInQ}
            title={`Toggle all teeth in ${label}`}
            className={`text-[10.5px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${colorClass}`}
          >
            {label} {allInQ ? '✓' : ''}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3" role="group" aria-label="FDI Dental Arch Chart">
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Tap teeth or quadrant labels to mark treated areas
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              aria-pressed={isUpperSelected}
              onClick={() => toggleGroup(UPPER_ARCH)}
              className={`min-h-10 sm:min-h-8 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isUpperSelected
                  ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-400 dark:border-teal-500 text-teal-800 dark:text-teal-200'
                  : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-teal-400 dark:hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-300'
              }`}
            >
              Upper Arch
            </button>
            <button
              type="button"
              aria-pressed={isLowerSelected}
              onClick={() => toggleGroup(LOWER_ARCH)}
              className={`min-h-10 sm:min-h-8 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isLowerSelected
                  ? 'bg-sky-50 dark:bg-sky-500/15 border-sky-400 dark:border-sky-500 text-sky-800 dark:text-sky-200'
                  : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-sky-400 dark:hover:border-sky-500 hover:text-sky-700 dark:hover:text-sky-300'
              }`}
            >
              Lower Arch
            </button>
            <button
              type="button"
              aria-pressed={isFullSelected}
              onClick={() => toggleGroup(FULL_MOUTH)}
              className={`min-h-10 sm:min-h-8 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isFullSelected
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-teal-400 dark:hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-300'
              }`}
            >
              Full Mouth
            </button>
            {selectedTeeth.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="min-h-10 sm:min-h-8 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-500/35 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-xs font-medium transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chart Layout */}
      <div className="bg-slate-50/80 dark:bg-gray-900/65 rounded-xl border border-slate-200/90 dark:border-gray-700/80 p-3 sm:p-4">
        <div className="space-y-3.5">
          {/* Maxillary (Upper Arch) */}
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 text-center">
              Upper Arch (Maxillary)
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-teal-50/40 dark:bg-teal-500/[0.06] border border-teal-200/60 dark:border-teal-500/20 space-y-2">
                {renderQuadrantHeader('Q1 · Upper Right', QUADRANT_1, false, 'teal')}
                <div className="grid grid-cols-4 min-[460px]:grid-cols-8 gap-1.5">
                  {QUADRANT_1.map(renderToothButton)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-teal-50/40 dark:bg-teal-500/[0.06] border border-teal-200/60 dark:border-teal-500/20 space-y-2">
                {renderQuadrantHeader('Q2 · Upper Left', QUADRANT_2, true, 'teal')}
                <div className="grid grid-cols-4 min-[460px]:grid-cols-8 gap-1.5">
                  {QUADRANT_2.map(renderToothButton)}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-200 dark:border-gray-700/80" />

          {/* Mandibular (Lower Arch) */}
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-sky-50/40 dark:bg-sky-500/[0.06] border border-sky-200/60 dark:border-sky-500/20 space-y-2">
                {renderQuadrantHeader('Q4 · Lower Right', QUADRANT_4, false, 'sky')}
                <div className="grid grid-cols-4 min-[460px]:grid-cols-8 gap-1.5">
                  {QUADRANT_4.map(renderToothButton)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-sky-50/40 dark:bg-sky-500/[0.06] border border-sky-200/60 dark:border-sky-500/20 space-y-2">
                {renderQuadrantHeader('Q3 · Lower Left', QUADRANT_3, true, 'sky')}
                <div className="grid grid-cols-4 min-[460px]:grid-cols-8 gap-1.5">
                  {QUADRANT_3.map(renderToothButton)}
                </div>
              </div>
            </div>
            <div className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-2 text-center">
              Lower Arch (Mandibular)
            </div>
          </div>
        </div>
      </div>

      {/* Selected Teeth Badges */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
          Selected ({selectedTeeth.length}):
        </span>
        {selectedTeeth.length === 0 ? (
          <span className="text-xs text-slate-400 dark:text-slate-500">Full-mouth / general</span>
        ) : (
          selectedTeeth.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-semibold tabular-nums bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-200 border border-teal-200/80 dark:border-teal-500/30"
            >
              #{t}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => toggleTooth(Number(t))}
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full hover:text-rose-600 dark:hover:text-rose-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] cursor-pointer"
                  aria-label={`Remove tooth ${t}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
