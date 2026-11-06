import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../schemas/authSchema';

export function LoginForm({
  onSuccess,
  onNavigateRegister,
  onNavigateForgotPassword,
}) {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const errors = {};
    const emailErr = validateEmail(email);
    if (emailErr) errors.email = emailErr;
    if (!password) errors.password = 'Password is required.';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const res = await login({ email, password });
    if (res.success) {
      onSuccess?.(res.user);
    } else {
      setFormError(res.error || 'Invalid email or password. Please verify your credentials.');
    }
  };

  const handleQuickFill = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setFormError(null);
    setFieldErrors({});
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Top Error Alert */}
      {formError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Sign in failed</p>
            <p className="text-xs text-rose-700 mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      {/* Email Input */}
      <div>
        <label
          htmlFor="login-email"
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          Email address
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: null }));
          }}
          placeholder="your.email@example.com"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder:text-slate-400 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
            fieldErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
          }`}
        />
        {fieldErrors.email && (
          <p id="login-email-error" className="mt-1 text-xs text-rose-600 font-medium">
            {fieldErrors.email}
          </p>
        )}
      </div>

      {/* Password Input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="login-password"
            className="block text-xs font-semibold text-slate-700"
          >
            Password
          </label>
          <button
            type="button"
            onClick={onNavigateForgotPassword}
            className="text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: null }));
            }}
            placeholder="••••••••••••"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
            className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl border text-sm text-slate-800 placeholder:text-slate-400 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
              fieldErrors.password ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {fieldErrors.password && (
          <p id="login-password-error" className="mt-1 text-xs text-rose-600 font-medium">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {/* Remember Me Checkbox */}
      <div className="flex items-center pt-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#0D9488] focus:ring-[#0D9488]"
          />
          <span>Remember my session on this device</span>
        </label>
      </div>

      {/* Primary Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full mt-2 py-3 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] active:bg-[#115E59] text-white font-semibold text-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Signing in...</span>
          </>
        ) : (
          <span>Sign In</span>
        )}
      </button>

      {/* Demo Credentials Quick Fill for all 3 Roles */}
      <div className="pt-3 border-t border-slate-100">
        <p className="text-[11px] text-slate-500 font-medium mb-1.5 flex items-center gap-1">
          <KeyRound className="w-3 h-3 text-slate-400" />
          <span>Quick Demo Access (Phase 4 / Seed Users):</span>
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => handleQuickFill('patient.juan@example.com', 'Password123!')}
            className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 font-medium transition-colors text-center"
          >
            Patient
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('dr.santos@toothcare.local', 'Password123!')}
            className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 font-medium transition-colors text-center"
          >
            Dentist
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('admin@toothcare.local', 'Password123!')}
            className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 font-medium transition-colors text-center"
          >
            Admin
          </button>
        </div>
      </div>

      {/* Link to Register */}
      <p className="text-center text-xs text-slate-600 pt-2">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={onNavigateRegister}
          className="font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded"
        >
          Create an account
        </button>
      </p>
    </form>
  );
}

export default LoginForm;
