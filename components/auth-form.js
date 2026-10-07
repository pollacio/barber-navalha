'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Scissors, Sparkles, User, Briefcase, ShieldCheck } from 'lucide-react';

const roleDetails = {
  ADMIN: { name: 'Administrador', description: 'Acesse o painel de gestão da barbearia.', email: 'admin@navalha.test', href: '/admin/login' },
  BARBER: { name: 'Barbeiro', description: 'Entre para conferir sua agenda e atendimentos.', email: 'lucas@navalha.test', href: '/barbeiro/login' },
  CUSTOMER: { name: 'Cliente', description: 'Entre para agendar seu próximo horário.', email: 'cliente@navalha.test', href: '/cliente/login' },
};

export default function AuthForm({ role = 'CUSTOMER', mode = 'login' }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const details = roleDetails[role];
  const [email, setEmail] = useState(mode === 'login' ? details.email : '');
  const [password, setPassword] = useState('');

  const isRegister = mode === 'register';
  const title = isRegister ? 'Crie sua conta' : mode === 'forgot' ? 'Recuperar senha' : `Bem-vindo, ${details.name}`;

  const handleQuickFill = () => {
    setEmail(details.email);
    setPassword('Navalha123!');
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    payload.acceptTerms = form.get('acceptTerms') === 'on';
    payload.tenantSlug = 'navalha-studio';

    try {
      const endpoint = isRegister ? '/api/auth/register' : mode === 'forgot' ? '/api/auth/forgot-password' : '/api/auth/login';
      if (!isRegister && mode !== 'forgot') payload.expectedRole = role;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível continuar.');
      if (mode === 'forgot') {
        setError(result.message || 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.');
        setLoading(false);
        return;
      }
      router.push(result.redirectTo);
      router.refresh();
    } catch (submitError) {
      setError(submitError.message);
      setLoading(false);
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-wrap">
        <Link className="auth-brand" href="/">
          <span className="auth-brand-inner"><span className="auth-brand-mark"><Scissors size={21} /></span><span><strong>Navalha</strong><small>STUDIO TECH</small></span></span>
        </Link>
        <section className="auth-card">
          <span className="auth-eyebrow">{isRegister ? 'SEU PRÓXIMO CORTE COMEÇA AQUI' : 'AUTENTICAÇÃO SEGURA'}</span>
          <h1>{title}</h1>
          <p className="auth-intro">{isRegister ? 'Cadastre-se para marcar horários e acompanhar seus atendimentos.' : details.description}</p>

          {mode === 'login' && (
            <div className="auth-role-tabs">
              <Link href="/cliente/login" className={`auth-role-tab ${role === 'CUSTOMER' ? 'active' : ''}`}>Cliente</Link>
              <Link href="/barbeiro/login" className={`auth-role-tab ${role === 'BARBER' ? 'active' : ''}`}>Barbeiro</Link>
              <Link href="/admin/login" className={`auth-role-tab ${role === 'ADMIN' ? 'active' : ''}`}>Gestão</Link>
            </div>
          )}

          <form className="auth-form" onSubmit={submit}>
            {isRegister && <label className="auth-field">Nome completo<input autoComplete="name" name="name" required minLength={2} maxLength={100} placeholder="Seu nome e sobrenome" /></label>}
            <label className="auth-field">E-mail<input autoComplete="email" name="email" type="email" required maxLength={254} placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            {isRegister && <label className="auth-field">Telefone / WhatsApp<input autoComplete="tel" name="phone" type="tel" required minLength={8} maxLength={24} placeholder="(11) 99999-9999" /></label>}
            {mode !== 'forgot' && <label className="auth-field"><span className="auth-password-row"><span>Senha</span>{!isRegister && role === 'CUSTOMER' && <Link href="/cliente/esqueci-senha">Esqueci minha senha</Link>}</span><input autoComplete={isRegister ? 'new-password' : 'current-password'} name="password" type="password" required minLength={isRegister ? 10 : 1} maxLength={128} placeholder={isRegister ? 'Mínimo de 10 caracteres' : 'Sua senha'} value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
            {isRegister && <label className="auth-field">Confirme sua senha<input autoComplete="new-password" name="confirmPassword" type="password" required minLength={10} maxLength={128} placeholder="Digite a senha novamente" /></label>}
            {isRegister && <label className="auth-terms"><input type="checkbox" name="acceptTerms" required /><span>Li e aceito os termos de uso e a política de privacidade.</span></label>}
            {error && <div className={mode === 'forgot' && !loading ? 'auth-success' : 'auth-error'} role="status">{error}</div>}
            <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Aguarde...' : isRegister ? 'CRIAR MINHA CONTA' : mode === 'forgot' ? 'ENVIAR INSTRUÇÕES' : 'ENTRAR NO SISTEMA'}{!loading && <ArrowRight size={15} />}</button>
          </form>

          {mode === 'login' && (
            <div className="auth-demo">
              <div><strong>Demonstração Pública:</strong> <code>{details.email}</code></div>
              <button type="button" className="auth-quick-fill-btn" onClick={handleQuickFill}>
                ⚡ Preencher credenciais de teste automaticamente
              </button>
            </div>
          )}

          <div className="auth-links">
            {isRegister ? <><span>Já tem conta?</span><Link href="/cliente/login">Fazer login</Link></> : mode === 'forgot' ? <Link href="/cliente/login">Voltar para o login</Link> : role === 'CUSTOMER' ? <><span>Ainda não tem conta?</span><Link href="/cliente/cadastro">Criar cadastro</Link></> : <Link href="/cliente/login">Acesso do cliente</Link>}
          </div>

          {mode === 'forgot' && <p className="auth-warning">A recuperação por e-mail precisa de um serviço de envio configurado pela barbearia.</p>}
        </section>
      </div>
    </main>
  );
}