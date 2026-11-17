import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Reusable profile photo header, uploader, preview, and validation block
 * shared across patient and practitioner profile summary cards.
 */
export function ProfilePhotoUploader({
  fullName,
  initials,
  serverAvatarUrl,
  badgeText = '',
  subtitle = '',
  onUploadFile,
  onRemoveFile,
  onSuccess,
  inputId = 'profile-avatar-input',
}) {
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarSuccess, setAvatarSuccess] = useState('');
  const [previewObjectUrl, setPreviewObjectUrl] = useState('');
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewObjectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  const activeAvatarSrc =
    previewObjectUrl || (serverAvatarUrl && failedAvatarUrl !== serverAvatarUrl ? serverAvatarUrl : null);

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setAvatarError('');
    setAvatarSuccess('');

    if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.type)) {
      setAvatarError('Please choose a JPG, PNG, or WebP image file.');
      return;
    }

    if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Profile photo must be 2 MB or smaller.');
      return;
    }

    let nextObjectUrl = '';
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      nextObjectUrl = URL.createObjectURL(file);
      setPreviewObjectUrl(nextObjectUrl);
    }

    setIsUploadingAvatar(true);
    try {
      const updated = await onUploadFile(file);
      setFailedAvatarUrl(null);
      setAvatarSuccess('Profile photo updated.');
      await onSuccess?.('Profile photo updated.', updated);
    } catch (err) {
      const serverValidationMsg = err.response?.data?.error?.details?.avatar?.[0];
      setAvatarError(
        serverValidationMsg ||
          err.response?.data?.error?.message ||
          err.message ||
          'Failed to upload profile photo.'
      );
    } finally {
      setIsUploadingAvatar(false);
      if (nextObjectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(nextObjectUrl);
      }
      setPreviewObjectUrl('');
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarError('');
    setAvatarSuccess('');
    setIsUploadingAvatar(true);

    try {
      const updated = await onRemoveFile();
      setPreviewObjectUrl('');
      setFailedAvatarUrl(null);
      setAvatarSuccess('Profile photo removed.');
      await onSuccess?.('Profile photo removed.', updated);
    } catch (err) {
      setAvatarError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to remove profile photo.'
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        <div className="w-24 h-24 rounded-2xl border-4 border-white dark:border-gray-700 shadow-md bg-[#CCFBF1] dark:bg-teal-900/60 text-[#0F766E] dark:text-teal-200 flex items-center justify-center font-bold text-2xl overflow-hidden">
          {activeAvatarSrc ? (
            <img
              src={activeAvatarSrc}
              alt={`${fullName} profile photo`}
              onError={() => setFailedAvatarUrl(serverAvatarUrl)}
              className="w-full h-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{initials}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingAvatar}
          aria-label="Choose profile photo"
          className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-[#12304A] dark:bg-teal-600 hover:bg-[#0D9488] dark:hover:bg-teal-500 text-white border-2 border-white dark:border-gray-800 shadow-sm flex items-center justify-center transition-colors disabled:opacity-60 cursor-pointer"
        >
          {isUploadingAvatar ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      <h2 className="mt-3 text-base font-bold text-[#12304A] dark:text-gray-100 leading-tight">
        {fullName}
      </h2>
      {badgeText ? (
        <p className="text-xs font-medium text-[#0F766E] dark:text-teal-300 mt-0.5">
          {badgeText}
        </p>
      ) : null}
      {subtitle ? (
        <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5 truncate max-w-full">
          {subtitle}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleAvatarFileChange}
        className="sr-only"
      />

      <div className="mt-4 w-full flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingAvatar}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold bg-[#0D9488] hover:bg-[#0F766E] dark:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white transition-colors disabled:opacity-60 cursor-pointer"
        >
          {isUploadingAvatar ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" />
              {serverAvatarUrl ? 'Change Photo' : 'Upload Photo'}
            </>
          )}
        </button>

        {serverAvatarUrl && (
          <button
            type="button"
            onClick={handleRemoveAvatar}
            disabled={isUploadingAvatar}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-red-600 dark:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-950/50 hover:border-red-200 dark:hover:border-rose-800 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </button>
        )}
      </div>

      <p className="mt-2.5 text-[11px] text-slate-600 dark:text-gray-400">
        JPG, PNG, or WebP up to 2 MB.
      </p>

      {avatarError && (
        <div
          role="alert"
          className="mt-3 w-full p-2.5 rounded-xl bg-red-50 dark:bg-rose-950/50 border border-red-200 dark:border-rose-800 text-red-700 dark:text-rose-300 text-xs flex items-start gap-2 text-left"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{avatarError}</span>
        </div>
      )}

      {avatarSuccess && (
        <div
          role="status"
          className="mt-3 w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2 text-left"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <span>{avatarSuccess}</span>
        </div>
      )}
    </div>
  );
}

export default ProfilePhotoUploader;
