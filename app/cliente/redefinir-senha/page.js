import { Suspense } from 'react';
import ResetPasswordForm from '@/components/reset-password-form';

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="auth-screen"><div className="auth-card">Carregando...</div></main>}><ResetPasswordForm /></Suspense>;
}