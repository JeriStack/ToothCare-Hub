import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ArrowLeft, Mail, Send } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../schemas/authSchema';

export function VerifyEmailPage({
  token: initialToken,
  onNavigateLogin,
  onNavigateHome,
}) {
  const { verifyEmail, resendVerification } = useAuth();

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const token = initialToken || (searchParams ? searchParams.get('token') : '') || '';

  const [status, setStatus] = useState('IDLE'); // 'IDLE' | 'VERIFYING' | 'SUCCESS' | 'ERROR' | 'NO_TOKEN'
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState(null);

  useEffect(() => {
    if (!token) {
      setStatus('NO_TOKEN');
      return;
    }

    let isMounted = true;
    const runVerification = async () => {
      setStatus('VERIFYING');
      const res = await verifyEmail(token);
      if (!isMounted) return;

      if (res.success) {
        setStatus('SUCCESS');
      } else {
        setStatus('ERROR');
        setErrorMessage(res.error || 'The verification link is invalid, expired, or has already been used.');
      }
    };

    runVerification();
    return () => {
      isMounted = false;
    };
  }, [token, verifyEmail]);

  const handleResend = async (e) => {
    e.preventDefault();
    setResendError(null);

    const emailErr = validateEmail(resendEmail);
    if (emailErr) {
      setResendError(emailErr);
      return;
    }

    setResendLoading(true);
    const res = await resendVerification(resendEmail);
    setResendLoading(false);

    if (res.success) {
      setResendSuccess(true);
    } else {
      setResendError(res.error || 'Failed to resend verification link.');
    }
  };

  return (
    <AuthLayout
      onNavigateHome={onNavigateHome}
      title="Email Verification"
      subtitle="Confirming your patient identity and email address"
    >
      {/* 1. Verifying State */}
      {status === 'VERIFYING' && (
        <div className="text-center py-8 space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#0D9488] mx-auto" />
          <div>
            <h2 className="text-lg font-bold text-[#12304A]">Verifying your email...</h2>
            <p className="text-xs text-slate-500 mt-1">Please wait while we confirm your security token.</p>
          </div>
        </div>
      )}

      {/* 2. Success State */}
      {status === 'SUCCESS' && (
        <div className="text-center py-4 space-y-5 animate-in fade-in duration-300">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#CCFBF1] text-[#0D9488] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#12304A]">Email Verified Successfully</h2>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
              Thank you! Your email address has been verified. Your patient account is now fully active,
              and you can proceed to sign in and schedule appointments.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onNavigateLogin}
              className="w-full py-3 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
            >
              Sign In to Patient Portal
            </button>
          </div>
        </div>
      )}

      {/* 3. Error or No Token State */}
      {(status === 'ERROR' || status === 'NO_TOKEN') && (
        <div className="text-center py-3 space-y-5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-[#12304A]">
              {status === 'NO_TOKEN' ? 'Verification Token Missing' : 'Verification Link Expired'}
            </h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
              {status === 'NO_TOKEN'
                ? 'No verification token was detected in the URL. If you need a new confirmation link, please enter your email address below.'
                : errorMessage}
            </p>
          </div>

          {/* Resend Form */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left">
            <h3 className="text-xs font-semibold text-slate-700 mb-2">Need a new verification link?</h3>
            {resendSuccess ? (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Verification link sent! Please check your inbox.</span>
              </div>
            ) : (
              <form onSubmit={handleResend} noValidate className="space-y-2">
                <div className="relative">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => {
                      setResendEmail(e.target.value);
                      if (resendError) setResendError(null);
                    }}
                    placeholder="Enter your registered email"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-800 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                {resendError && (
                  <p className="text-[11px] text-rose-600 font-medium">{resendError}</p>
                )}
                <button
                  type="submit"
                  disabled={resendLoading}
                  className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                >
                  {resendLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Resend Verification Email</span>
                </button>
              </form>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onNavigateLogin}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to sign in</span>
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

export default VerifyEmailPage;
