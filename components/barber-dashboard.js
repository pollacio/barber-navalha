'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Check, Clock3, Scissors, UserRound } from 'lucide-react';

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

function dateKey(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatTime(date, timezone) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}

export default function BarberDashboard({ barber, tenant, appointments: initialAppointments, blockedTimes }) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [view, setView] = useState('day');
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date(), tenant.timezone));
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [blockError, setBlockError] = useState('');

  const visibleAppointments = appointments.filter((appointment) => {
    const date = dateKey(new Date(appointment.startsAt), tenant.timezone);
    return view === 'week' || date === selectedDate;
  });
  const upcoming = visibleAppointments.filter((appointment) => new Date(appointment.startsAt) >= new Date() && ['PENDENTE', 'CONFIRMADO'].includes(appointment.status));
  const completed = visibleAppointments.filter((appointment) => appointment.status === 'CONCLUIDO').length;

  const updateAppointment = async (appointmentId, action) => {
    setBusy(appointmentId);
    setMessage('');
    const response = await fetch(`/api/barber/appointments/${appointmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const result = await response.json();
    setBusy('');
    if (!response.ok) return setMessage(result.error || 'Não foi possível atualizar o atendimento.');
    setAppointments((current) => current.map((appointment) => appointment.id === appointmentId ? { ...appointment, status: result.appointment.status } : appointment).filter((appointment) => appointment.status !== 'CANCELADO'));
    setMessage(action === 'confirm' ? 'Atendimento confirmado.' : action === 'complete' ? 'Atendimento concluído.' : 'Atendimento atualizado.');
  };

  const createBlock = async (event) => {
    event.preventDefault();
    setBlockError('');
    const form = new FormData(event.currentTarget);
    const date = String(form.get('date'));
    const startsAt = new Date(`${date}T${form.get('start')}`);
    const endsAt = new Date(`${date}T${form.get('end')}`);
    const response = await fetch('/api/barber/blocked-times', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), reason: String(form.get('reason') || 'Bloqueio pessoal') }),
    });
    const result = await response.json();
    if (!response.ok) return setBlockError(result.error || 'Não foi possível bloquear esse intervalo.');
    event.currentTarget.reset();
    setBlockError('Horário bloqueado para novos agendamentos.');
  };

  return <main className="barber-main">
    <header className="barber-header"><div><span className="customer-eyebrow">ÁREA DO BARBEIRO · {tenant.name.toUpperCase()}</span><h1>Olá, {barber.name.split(' ')[0]}.</h1><p>{barber.specialties || 'Sua agenda, seus atendimentos.'}</p></div><div className="barber-header-actions"><button className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}>DIA</button><button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>SEMANA</button><Link href="/api/auth/logout" onClick={async (event) => { event.preventDefault(); await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/barbeiro/login'; }}><UserRound size={12} /> SAIR</Link></div></header>
    <section className="barber-stats"><article className="barber-stat"><span>{view === 'day' ? 'HORÁRIOS HOJE' : 'HORÁRIOS NA SEMANA'}</span><strong>{visibleAppointments.length}</strong></article><article className="barber-stat"><span>PRÓXIMOS CLIENTES</span><strong>{upcoming.length}</strong></article><article className="barber-stat"><span>CONCLUÍDOS</span><strong>{completed}</strong></article><article className="barber-stat"><span>VALOR AGENDADO</span><strong>{money(visibleAppointments.filter((item) => ['PENDENTE', 'CONFIRMADO'].includes(item.status)).reduce((sum, item) => sum + item.priceCents, 0))}</strong></article></section>
    <section className="customer-panel barber-agenda"><div className="barber-agenda-toolbar"><div><h2>{view === 'day' ? 'Agenda do dia' : 'Agenda da semana'}</h2><span>{view === 'day' ? new Intl.DateTimeFormat('pt-BR', { timeZone: tenant.timezone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${selectedDate}T12:00:00`)) : 'Atendimentos próximos · próximos 7 dias'}</span></div>{view === 'day' && <input aria-label="Selecionar dia" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />}</div>
      {message && <div className="wizard-message" role="status" style={{ margin: '10px 15px 0' }}>{message}</div>}
      <div className="barber-day-list">{visibleAppointments.map((appointment) => {
        const customer = appointment.customer.user;
        return <article className="barber-appointment" key={appointment.id}><span className="barber-appointment-time"><strong>{formatTime(appointment.startsAt, tenant.timezone)}</strong><small>{dateKey(new Date(appointment.startsAt), tenant.timezone)}</small></span><span className="barber-customer-avatar">{customer.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span className="barber-customer-info"><strong>{customer.name}</strong><div><span><Scissors size={10} /> {appointment.service.name}</span><span><Clock3 size={10} /> {appointment.durationMinutes} min</span><span>{money(appointment.priceCents)}</span>{customer.phone && <a href={`tel:${customer.phone}`}>{customer.phone}</a>}<span className="appointment-status">{appointment.status}</span></div></span><span className="barber-appointment-actions">{appointment.status === 'PENDENTE' && <button disabled={busy === appointment.id} onClick={() => updateAppointment(appointment.id, 'confirm')}>CONFIRMAR</button>}{['PENDENTE', 'CONFIRMADO'].includes(appointment.status) && <><button disabled={busy === appointment.id} onClick={() => updateAppointment(appointment.id, 'complete')}><Check size={11} /> CONCLUIR</button><button className="danger" disabled={busy === appointment.id} onClick={() => updateAppointment(appointment.id, 'cancel')}>CANCELAR</button></>}</span></article>;
      })}{visibleAppointments.length === 0 && <div className="barber-empty"><CalendarDays size={22} /><strong>Agenda livre neste período.</strong><p>Novos agendamentos serão vinculados automaticamente à sua agenda.</p></div>}</div>
    </section>
    <section className="customer-panel barber-block-panel"><h2>Bloquear um horário</h2><p>Bloqueios pessoais deixam a agenda indisponível para novos clientes.</p>{blockError && <div className={blockError.startsWith('Horário') ? 'auth-success' : 'wizard-message'} style={{ marginBottom: 10 }}>{blockError}</div>}<form className="barber-block-form" onSubmit={createBlock}><label>Data<input type="date" name="date" min={dateKey(new Date(), tenant.timezone)} required /></label><label>Início<input type="time" name="start" required /></label><label>Fim<input type="time" name="end" required /></label><label>Motivo<input name="reason" maxLength={160} placeholder="Compromisso pessoal" /></label><button type="submit">BLOQUEAR</button></form>{blockedTimes.length > 0 && <p className="barber-blocked-list">Bloqueios futuros: {blockedTimes.map((item) => `${new Intl.DateTimeFormat('pt-BR', { timeZone: tenant.timezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(item.startsAt)}`).join(' · ')}</p>}</section>
    <p className="customer-policy-note">Você visualiza somente seus próprios atendimentos e clientes.</p>
  </main>;
}