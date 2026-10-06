'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Scissors } from 'lucide-react';

export default function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.get('token') || '', password: form.get('password'), confirmPassword: form.get('confirmPassword') }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || 'Não foi possível atualizar sua senha.');
      setLoading(false);
      return;
    }
    router.push('/cliente/login?senha=atualizada');
  };

  return <main className="auth-screen"><div className="auth-wrap"><Link className="auth-brand" href="/cliente/login"><span className="auth-brand-inner"><span className="auth-brand-mark"><Scissors size={21} /></span><span><strong>Navalha</strong><small>STUDIO & BARBER</small></span></span></Link><section className="auth-card"><span className="auth-eyebrow">LINK ÚNICO · VÁLIDO POR 30 MINUTOS</span><h1>Crie uma nova senha</h1><p className="auth-intro">Escolha uma senha segura com pelo menos 10 caracteres.</p><form className="auth-form" onSubmit={submit}><label className="auth-field">Nova senha<input name="password" type="password" required minLength={10} autoComplete="new-password" /></label><label className="auth-field">Confirme a nova senha<input name="confirmPassword" type="password" required minLength={10} autoComplete="new-password" /></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" disabled={loading}>{loading ? 'AGUARDE...' : 'ATUALIZAR SENHA'} {!loading && <ArrowRight size={15} />}</button></form><div className="auth-links"><Link href="/cliente/login">Voltar para o login</Link></div></section></div></main>;
}