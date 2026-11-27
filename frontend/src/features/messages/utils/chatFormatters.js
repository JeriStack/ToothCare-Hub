const MANILA_TZ = 'Asia/Manila';

function toDate(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  return Number.isNaN(d.getTime()) ? null : d;
}

function manilaDayKey(date) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: MANILA_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function formatChatTime(isoString) {
  const date = toDate(isoString);
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '';
  }
}

export function formatConversationTimestamp(isoString) {
  const date = toDate(isoString);
  if (!date) return '';
  const now = new Date();
  const todayKey = manilaDayKey(now);
  const yesterday = new Date(now.getTime() - 86400000);
  const yesterdayKey = manilaDayKey(yesterday);
  const targetKey = manilaDayKey(date);

  if (targetKey === todayKey) {
    return formatChatTime(isoString);
  }
  if (targetKey === yesterdayKey) {
    return 'Yesterday';
  }

  const sameYear = targetKey.slice(0, 4) === todayKey.slice(0, 4);
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TZ,
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    }).format(date);
  } catch {
    return targetKey;
  }
}

export function formatDaySeparator(isoString) {
  const date = toDate(isoString);
  if (!date) return '';
  const now = new Date();
  const todayKey = manilaDayKey(now);
  const yesterdayKey = manilaDayKey(new Date(now.getTime() - 86400000));
  const targetKey = manilaDayKey(date);

  if (targetKey === todayKey) return 'Today';
  if (targetKey === yesterdayKey) return 'Yesterday';

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TZ,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: targetKey.slice(0, 4) === todayKey.slice(0, 4) ? undefined : 'numeric',
    }).format(date);
  } catch {
    return targetKey;
  }
}

export function getDayKey(isoString) {
  const date = toDate(isoString);
  return date ? manilaDayKey(date) : '';
}

export function formatAppointmentChipDate(isoString) {
  const date = toDate(isoString);
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TZ,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '';
  }
}

export function minutesBetween(isoA, isoB) {
  const a = toDate(isoA);
  const b = toDate(isoB);
  if (!a || !b) return Infinity;
  return Math.abs(b.getTime() - a.getTime()) / 60000;
}
