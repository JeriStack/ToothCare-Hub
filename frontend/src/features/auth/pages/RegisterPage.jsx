import React from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { RegisterForm } from '../components/RegisterForm';

export function RegisterPage({
  onSuccess,
  onNavigateLogin,
  onNavigateHome,
}) {
  return (
    <AuthLayout
      onNavigateHome={onNavigateHome}
      title="Create Patient Account"
      subtitle="Join ToothCare Hub to book dental appointments and access your records"
    >
      <RegisterForm
        onSuccess={onSuccess}
        onNavigateLogin={onNavigateLogin}
      />
    </AuthLayout>
  );
}

export default RegisterPage;
