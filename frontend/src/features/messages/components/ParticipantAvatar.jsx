import React, { useState, useEffect } from 'react';

const SIZE_CLASSES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-11 h-11 text-xs',
  lg: 'w-12 h-12 text-sm',
};

const DOT_CLASSES = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2.5 h-2.5 border-[1.5px]',
  md: 'w-3 h-3 border-2',
  lg: 'w-3.5 h-3.5 border-2',
};

export function ParticipantAvatar({
  avatarUrl = null,
  initials = 'U',
  name = '',
  isOnline = false,
  showOnlineDot = false,
  size = 'md',
  className = '',
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const dotClass = DOT_CLASSES[size] || DOT_CLASSES.md;
  const showImg = Boolean(avatarUrl && !failed);

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${sizeClass} rounded-full overflow-hidden flex items-center justify-center font-semibold bg-[#CCFBF1] dark:bg-teal-900/60 text-[#0F766E] dark:text-teal-200 border border-slate-200/80 dark:border-gray-700 select-none`}
      >
        {showImg ? (
          <img
            src={avatarUrl}
            alt={name ? `${name} avatar` : ''}
            onError={() => setFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{initials || 'U'}</span>
        )}
      </div>
      {showOnlineDot && isOnline && (
        <span
          aria-hidden="true"
          className={`absolute bottom-0 right-0 ${dotClass} rounded-full border-[var(--chat-surface)]`}
          style={{ backgroundColor: 'var(--chat-online)' }}
        />
      )}
    </div>
  );
}

export default ParticipantAvatar;
