'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, Clock3, Scissors } from 'lucide-react';

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const tabs = ['PRÓXIMOS', 'HISTÓRICO', 'CANCELADOS'];

export default function CustomerAppointments({ appointments, timezone, cancellationNoticeHours }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('PRÓXIMOS');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const now = Date.now();
  const upcoming = appointments.filter((item) => ['PENDENTE', 'CONFIRMADO'].includes(item.status) && new Date(item.startsAt).getTime() >= now);
  const canceled = appointments.filter((item) => item.status === 'CANCELADO');
  const history = appointments.filter((item) => item.status === 'CONCLUIDO' || item.status === 'NAO_COMPARECEU' || (['PENDENTE', 'CONFIRMADO'].includes(item.status) && new Date(item.startsAt).getTime() < now));
  const visible = activeTab === 'PRÓXIMOS' ? upcoming : activeTab === 'HISTÓRICO' ? history : canceled;

  const cancelAppointment = async (id) => {
    setBusyId(id);
    setError('');
    const response = await fetch(`/api/customer/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    const result = await response.json();
    setBusyId('');
    setConfirmId('');
    if (!response.ok) return setError(result.error || 'Não foi possível cancelar.');
    router.refresh();
  };

  return <main className="customer-main">
    <div className="customer-account-heading"><div><span className="customer-eyebrow">SUA JORNADA</span><h1 className="customer-title">Meus agendamentos</h1><p className="customer-subtitle">Seus próximos momentos e o histórico das suas visitas.</p></div><Link className="customer-gold-button" href="/cliente/novo-agendamento"><CalendarDays size={14} /> NOVO HORÁRIO</Link></div>
    <section className="customer-panel">
      <div className="customer-tabs">{tabs.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => { setActiveTab(tab); setError(''); }}>{tab} {tab === 'PRÓXIMOS' && upcoming.length > 0 ? `(${upcoming.length})` : ''}</button>)}</div>
      {error && <div className="wizard-message" style={{ margin: '12px 13px 0' }}>{error}</div>}
      {visible.length ? <div className="customer-booking-list">{visible.map((appointment) => {
        const date = new Date(appointment.startsAt);
        const day = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, day: '2-digit' }).format(date);
        const month = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, month: 'short' }).format(date).replace('.', '');
        const time = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(date);
        const canCancel = ['PENDENTE', 'CONFIRMADO'].includes(appointment.status) && date.getTime() - now >= cancellationNoticeHours * 3600000;
        return <article className="customer-booking-card" key={appointment.id}>
          <span className="customer-booking-date"><strong>{day}</strong><small>{month}</small></span>
          <span className="customer-booking-summary"><strong>{appointment.service.name}{appointment.hairStyle ? ` · ${appointment.hairStyle.name}` : ''}</strong><span>{appointment.barber.name} · {time} · {appointment.durationMinutes} min</span><span className="customer-booking-meta"><span>{money(appointment.priceCents)}</span><span>·</span><span className="appointment-status">{appointment.status}</span></span></span>
          <span className="customer-booking-actions">{activeTab === 'PRÓXIMOS' && <Link href={`/cliente/novo-agendamento?rebook=${appointment.id}`}>Reagendar</Link>}{canCancel && <button className="cancel" onClick={() => setConfirmId(appointment.id)}>Cancelar</button>}<Link href={`/cliente/meus-agendamentos#${appointment.code}`}>Ver detalhes</Link></span>
          {confirmId === appointment.id && <span className="cancel-confirm"><span>Cancelar este horário? A vaga será liberada.</span><button disabled={busyId === appointment.id} onClick={() => cancelAppointment(appointment.id)}>{busyId === appointment.id ? 'Cancelando...' : 'Confirmar cancelamento'}</button><button onClick={() => setConfirmId('')}>Voltar</button></span>}
        </article>;
      })}</div> : <div className="customer-empty"><Scissors size={21} /><strong>{activeTab === 'PRÓXIMOS' ? 'Nenhum horário marcado.' : 'Nada por aqui ainda.'}</strong><p>{activeTab === 'PRÓXIMOS' ? 'Escolha um serviço e encontre um horário disponível.' : 'Seus atendimentos concluídos aparecerão aqui.'}</p>{activeTab === 'PRÓXIMOS' && <Link className="customer-gold-button" href="/cliente/novo-agendamento">AGENDAR AGORA <CalendarDays size={13} /></Link>}</div>}
    </section>
    <p className="customer-policy-note"><Clock3 size={13} /> Cancelamentos podem ser feitos até {cancellationNoticeHours} horas antes do atendimento, conforme a política da barbearia.</p>
  </main>;
}