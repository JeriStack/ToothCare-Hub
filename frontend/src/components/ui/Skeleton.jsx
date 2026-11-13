import React from 'react';

/**
 * ToothCare Hub Reusable Base Skeleton Component
 *
 * Provides accessible, theme-aware pulsing or shimmering placeholder surfaces
 * adhering to ToothCare Hub & Impeccable Design System standards.
 * Eliminates Cumulative Layout Shift (CLS) during asynchronous API fetching.
 *
 * @param {string} className - Tailwind CSS utility classes.
 * @param {'pulse' | 'shimmer' | 'none'} animation - Animation style (default: 'pulse').
 * @param {'rect' | 'circle' | 'pill'} shape - Geometry preset.
 * @param {string | number} width - Optional explicit width (e.g. '100%', 200, 'w-32').
 * @param {string | number} height - Optional explicit height (e.g. 16, 'h-4').
 * @param {string} srText - Optional screen reader announcement text.
 * @param {React.ReactNode} children - Optional nested placeholder elements.
 */
export function Skeleton({
  className = '',
  animation = 'pulse',
  shape = 'rect',
  width,
  height,
  srText,
  children,
  style,
  as: Component = 'div',
  ...props
}) {
  const animationClass = {
    pulse: 'animate-pulse motion-reduce:animate-none',
    shimmer:
      'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 dark:before:via-white/10 before:to-transparent motion-reduce:before:animate-none',
    none: '',
  }[animation] || 'animate-pulse motion-reduce:animate-none';

  const shapeClass = {
    rect: 'rounded-md',
    circle: 'rounded-full',
    pill: 'rounded-full',
  }[shape] || 'rounded-md';

  const customStyle = { ...style };
  if (typeof width === 'number') customStyle.width = `${width}px`;
  else if (typeof width === 'string' && !width.startsWith('w-')) customStyle.width = width;

  if (typeof height === 'number') customStyle.height = `${height}px`;
  else if (typeof height === 'string' && !height.startsWith('h-')) customStyle.height = height;

  return (
    <Component
      role="presentation"
      aria-hidden="true"
      className={`bg-slate-200/80 dark:bg-slate-700/80 text-transparent select-none transition-colors ${shapeClass} ${animationClass} ${className}`}
      style={customStyle}
      {...props}
    >
      {srText && <span className="sr-only">{srText}</span>}
      {children}
    </Component>
  );
}

/**
 * SkeletonText - Renders multi-line text placeholders with natural ragging
 */
export function SkeletonText({
  lines = 3,
  className = '',
  lineHeight = 'h-3.5',
  lastLineWidth = 'w-3/5',
  gap = 'space-y-2',
}) {
  return (
    <div className={`w-full ${gap} ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => {
        const isLast = index === lines - 1;
        const widthClass = isLast && lines > 1 ? lastLineWidth : 'w-full';
        return (
          <Skeleton
            key={index}
            className={`${lineHeight} ${widthClass}`}
          />
        );
      })}
    </div>
  );
}

/**
 * SkeletonAvatar - Circular or rounded avatar placeholder
 */
export function SkeletonAvatar({
  size = 'md',
  shape = 'circle',
  className = '',
}) {
  const sizeClass = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-24 h-24',
  }[size] || size;

  return (
    <Skeleton
      shape={shape}
      className={`shrink-0 ${sizeClass} ${className}`}
    />
  );
}

/**
 * SkeletonButton - Button-shaped placeholder matching ToothCare Hub buttons
 */
export function SkeletonButton({
  size = 'md',
  width = 'w-28',
  className = '',
}) {
  const heightClass = {
    sm: 'h-8 text-xs rounded-lg',
    md: 'h-10 text-sm rounded-xl',
    lg: 'h-12 text-base rounded-xl',
  }[size] || 'h-10 rounded-xl';

  return (
    <Skeleton
      className={`${heightClass} ${width} ${className}`}
    />
  );
}

Skeleton.Text = SkeletonText;
Skeleton.Avatar = SkeletonAvatar;
Skeleton.Button = SkeletonButton;

export default Skeleton;
