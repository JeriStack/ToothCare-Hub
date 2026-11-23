import React from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { RegisterForm } from '../components/RegisterForm';

export function RegisterPage({
  onSuccess,
  onNavigateLogin,
  onNavigateHome,
  onNavigateTerms,
  onNavigatePrivacy,
}) {
  return (
    <AuthLayout
      onNavigateHome={onNavigateHome}
      onNavigateTerms={onNavigateTerms}
      onNavigatePrivacy={onNavigatePrivacy}
      title="Create Patient Account"
      subtitle="Join ToothCare Hub to book dental appointments and access your records"
    >
      <RegisterForm
        onSuccess={onSuccess}
        onNavigateLogin={onNavigateLogin}
        onNavigateTerms={onNavigateTerms}
        onNavigatePrivacy={onNavigatePrivacy}
      />
    </AuthLayout>
  );
}

export default RegisterPage;
