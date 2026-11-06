import React from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { LoginForm } from '../components/LoginForm';

export function LoginPage({
  onSuccess,
  onNavigateRegister,
  onNavigateForgotPassword,
  onNavigateHome,
}) {
  return (
    <AuthLayout
      onNavigateHome={onNavigateHome}
      title="Welcome Back"
      subtitle="Sign in to your account to manage your dental appointments"
    >
      <LoginForm
        onSuccess={onSuccess}
        onNavigateRegister={onNavigateRegister}
        onNavigateForgotPassword={onNavigateForgotPassword}
      />
    </AuthLayout>
  );
}

export default LoginPage;
