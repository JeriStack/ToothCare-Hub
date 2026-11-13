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
    // Return sorted array of numbers
    onChange(Array.from(next).sort((a, b) => a - b));
  };

  const selectUpperArch = () => {
    if (readOnly) return;
    const next = new Set(selectedSet);
    [...QUADRANT_1, ...QUADRANT_2].forEach((t) => next.add(t));
    onChange(Array.from(next).sort((a, b) => a - b));
  };

  const selectLowerArch = () => {
    if (readOnly) return;
    const next = new Set(selectedSet);
    [...QUADRANT_4, ...QUADRANT_3].forEach((t) => next.add(t));
    onChange(Array.from(next).sort((a, b) => a - b));
  };

  const clearAll = () => {
    if (readOnly) return;
    onChange([]);
  };

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
        className={`w-8 h-9 sm:w-9 sm:h-10 rounded-md text-xs font-semibold flex flex-col items-center justify-center transition-all ${
          isSelected
            ? 'bg-[#0D9488] text-white border-2 border-[#0F766E] dark:border-teal-300 shadow-sm scale-105 ring-2 ring-[#0D9488]/30 dark:ring-teal-400/35'
            : readOnly
            ? 'bg-slate-100 dark:bg-gray-700/70 text-slate-400 dark:text-gray-400 border border-slate-200 dark:border-gray-600 cursor-not-allowed opacity-60'
            : 'bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 hover:border-teal-400 dark:hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-900/40 hover:text-teal-900 dark:hover:text-teal-200'
        }`}
      >
        <span>{tooth}</span>
        {isSelected && <Check className="w-2.5 h-2.5 mt-0.5" />}
      </button>
    );
  };

  return (
    <div className="space-y-4" role="group" aria-label="FDI Dental Arch Chart">
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-600 dark:text-gray-300">
            Click teeth numbers to indicate areas treated (FDI 2-Digit Notation):
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectUpperArch}
              className="px-2.5 py-1 text-slate-600 dark:text-gray-200 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded border border-slate-200 dark:border-gray-700 font-medium"
            >
              + Upper Arch
            </button>
            <button
              type="button"
              onClick={selectLowerArch}
              className="px-2.5 py-1 text-slate-600 dark:text-gray-200 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded border border-slate-200 dark:border-gray-700 font-medium"
            >
              + Lower Arch
            </button>
            {selectedTeeth.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="px-2.5 py-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded border border-rose-200 dark:border-rose-800/70 font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chart Layout */}
      <div className="bg-slate-50/80 dark:bg-gray-900/70 rounded-xl border border-slate-200/90 dark:border-gray-700 p-4 sm:p-5 overflow-x-auto">
        <div className="min-w-[540px] space-y-4">
          {/* Maxillary (Upper Arch) */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-400 mb-2 text-center">
              ▲ Upper Arch (Maxillary) — Midline ▲
            </div>
            <div className="flex items-center justify-center gap-1 sm:gap-1.5">
              {/* Quadrant 1: 18 -> 11 */}
              <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 rounded-lg bg-teal-50/40 dark:bg-teal-950/35 border border-teal-100/60 dark:border-teal-800/50">
                <span className="text-[10px] font-bold text-teal-800/70 dark:text-teal-300/80 mr-1 hidden sm:inline">Q1</span>
                {QUADRANT_1.map(renderToothButton)}
              </div>

              {/* Midline Divider */}
              <div className="w-px h-10 bg-slate-300 dark:bg-gray-600 mx-1 shrink-0" aria-hidden="true" />

              {/* Quadrant 2: 21 -> 28 */}
              <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 rounded-lg bg-teal-50/40 dark:bg-teal-950/35 border border-teal-100/60 dark:border-teal-800/50">
                {QUADRANT_2.map(renderToothButton)}
                <span className="text-[10px] font-bold text-teal-800/70 dark:text-teal-300/80 ml-1 hidden sm:inline">Q2</span>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-200 dark:border-gray-700 my-2" />

          {/* Mandibular (Lower Arch) */}
          <div>
            <div className="flex items-center justify-center gap-1 sm:gap-1.5">
              {/* Quadrant 4: 48 -> 41 */}
              <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 rounded-lg bg-sky-50/40 dark:bg-sky-950/35 border border-sky-100/60 dark:border-sky-800/50">
                <span className="text-[10px] font-bold text-sky-800/70 dark:text-sky-300/80 mr-1 hidden sm:inline">Q4</span>
                {QUADRANT_4.map(renderToothButton)}
              </div>

              {/* Midline Divider */}
              <div className="w-px h-10 bg-slate-300 dark:bg-gray-600 mx-1 shrink-0" aria-hidden="true" />

              {/* Quadrant 3: 31 -> 38 */}
              <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 rounded-lg bg-sky-50/40 dark:bg-sky-950/35 border border-sky-100/60 dark:border-sky-800/50">
                {QUADRANT_3.map(renderToothButton)}
                <span className="text-[10px] font-bold text-sky-800/70 dark:text-sky-300/80 ml-1 hidden sm:inline">Q3</span>
              </div>
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-400 mt-2 text-center">
              ▼ Lower Arch (Mandibular) — Midline ▼
            </div>
          </div>
        </div>
      </div>

      {/* Selected Teeth Badges */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">Selected Teeth ({selectedTeeth.length}):</span>
        {selectedTeeth.length === 0 ? (
          <span className="text-xs text-slate-400 dark:text-gray-400 italic">None selected (or full-mouth general procedure)</span>
        ) : (
          selectedTeeth.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#CCFBF1] dark:bg-teal-900/60 text-[#0F766E] dark:text-teal-200 border border-teal-200 dark:border-teal-700"
            >
              #{t}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => toggleTooth(Number(t))}
                  className="hover:text-rose-600 focus:outline-none"
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
