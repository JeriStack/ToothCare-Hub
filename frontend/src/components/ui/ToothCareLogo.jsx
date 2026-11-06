import React from 'react';

/**
 * Official ToothCare Hub Brand Logo Component
 * Renders the 3D tooth emblem with orbital medical cross ring and signature typography.
 *
 * @param {'full' | 'icon' | 'mark'} variant
 * @param {'light' | 'dark'} theme
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl'} size
 */
export function ToothCareLogo({
  variant = 'full',
  theme = 'light',
  size = 'md',
  showTagline = false,
  className = '',
  onClick,
}) {
  const sizeClasses = {
    xs: { icon: 'w-7 h-7', text: 'text-base', sub: 'text-[9px]' },
    sm: { icon: 'w-8 h-8', text: 'text-lg', sub: 'text-[10px]' },
    md: { icon: 'w-10 h-10', text: 'text-xl', sub: 'text-[11px]' },
    lg: { icon: 'w-12 h-12', text: 'text-2xl', sub: 'text-xs' },
    xl: { icon: 'w-16 h-16', text: 'text-3xl', sub: 'text-sm' },
  }[size] || { icon: 'w-10 h-10', text: 'text-xl', sub: 'text-[11px]' };

  // 1. Icon-only variant
  if (variant === 'icon') {
    return (
      <div
        onClick={onClick}
        className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses.icon} ${className}`}
      >
        <img
          src={theme === 'dark' ? '/images/logo-icon-dark.jpg' : '/images/logo-full.png'}
          alt="ToothCare Hub Emblem"
          className="w-full h-full object-contain rounded-xl select-none"
          loading="eager"
        />
      </div>
    );
  }

  // 2. Full official badge image (pure image variant)
  if (variant === 'full-image') {
    return (
      <img
        src="/images/logo-full.png"
        alt="ToothCare Hub - Healthier Smiles. Brighter Futures."
        className={`h-auto object-contain select-none ${className}`}
        onClick={onClick}
      />
    );
  }

  // 3. Composite full logo (emblem image + crisp responsive typography)
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className={`relative ${sizeClasses.icon} shrink-0 rounded-xl overflow-hidden shadow-xs flex items-center justify-center`}>
        <img
          src={theme === 'dark' ? '/images/logo-icon-dark.jpg' : '/images/logo-full.png'}
          alt="ToothCare Hub"
          className="w-full h-full object-contain select-none"
          loading="eager"
        />
      </div>

      <div className="flex flex-col text-left">
        <span
          className={`font-bold tracking-tight leading-tight ${sizeClasses.text} ${
            theme === 'dark' ? 'text-white' : 'text-[#12304A]'
          }`}
        >
          Tooth<span className="text-[#0D9488]">Care</span>{' '}
          <span className={theme === 'dark' ? 'text-slate-100' : 'text-[#12304A]'}>Hub</span>
        </span>
        {showTagline ? (
          <span
            className={`font-medium tracking-wide ${sizeClasses.sub} ${
              theme === 'dark' ? 'text-teal-200/80' : 'text-slate-500'
            }`}
          >
            Healthier Smiles. Brighter Futures.
          </span>
        ) : (
          <span
            className={`font-medium tracking-wide ${sizeClasses.sub} ${
              theme === 'dark' ? 'text-teal-200/70' : 'text-slate-500'
            }`}
          >
            Dental Clinic &amp; Care
          </span>
        )}
      </div>
    </div>
  );
}

export default ToothCareLogo;
