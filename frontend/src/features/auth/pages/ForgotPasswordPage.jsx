import React, { useState } from 'react';
import { Mail, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../schemas/authSchema';

export function ForgotPasswordPage({
  onNavigateLogin,
  onNavigateHome,
}) {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldError, setFieldError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const emailErr = validateEmail(email);
    if (emailErr) {
      setFieldError(emailErr);
      return;
    }
    setFieldError(null);

    setIsLoading(true);
    try {
      await forgotPassword(email);
      // Always show success to prevent account enumeration
      setIsSubmitted(true);
    } catch {
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      onNavigateHome={onNavigateHome}
      title="Reset Your Password"
      subtitle="Enter the email address associated with your account"
    >
      {isSubmitted ? (
        <div className="text-center py-4 space-y-5 animate-in fade-in duration-300">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#CCFBF1] text-[#0D9488] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#12304A]">Instructions Dispatched</h2>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
              If an account is associated with <strong className="text-slate-800">{email}</strong>,
              we have sent instructions to reset your password. Please inspect your inbox and spam folder.
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={onNavigateLogin}
              className="w-full py-3 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
            >
              Return to Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSubmitted(false);
                setEmail('');
              }}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
            >
              Try another email address
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs font-medium">{formError}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="forgot-email"
              className="block text-xs font-bold text-[#12304A] mb-1.5"
            >
              Email address
            </label>
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#E6F7F5] flex items-center justify-center text-[#0D9488] pointer-events-none">
                <Mail className="w-4 h-4 stroke-[2.2]" />
              </div>
              <input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldError) setFieldError(null);
                }}
                placeholder="youremail@example.com"
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? 'forgot-email-error' : undefined}
                className={`w-full pl-12 pr-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder:text-slate-400 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                  fieldError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
                }`}
              />
            </div>
            {fieldError && (
              <p id="forgot-email-error" className="mt-1 text-xs text-rose-600 font-medium">
                {fieldError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] active:bg-[#115E59] text-white font-semibold text-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending instructions...</span>
              </>
            ) : (
              <span>Send Reset Instructions</span>
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onNavigateLogin}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to sign in</span>
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
