import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * Reusable EmptyState Component adhering to ToothCare Hub Design System.
 *
 * @param {string} title
 * @param {string} description
 * @param {React.ReactNode} icon
 * @param {React.ReactNode} action
 */
export function EmptyState({
  title = 'No records found',
  description = 'There are no items to display at this time.',
  icon: Icon = Inbox,
  action,
  className = '',
}) {
  return (
    <div
      role="region"
      aria-label={title}
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl bg-white border border-slate-100 shadow-xs max-w-lg mx-auto ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#F5F8FA] border border-slate-200/80 flex items-center justify-center text-[#12304A] mb-4 shadow-2xs">
        {React.isValidElement(Icon) ? (
          Icon
        ) : (
          <Icon className="w-7 h-7 text-slate-400" aria-hidden="true" />
        )}
      </div>

      <h3 className="text-base font-bold text-[#12304A] tracking-tight mb-1.5">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export default EmptyState;
