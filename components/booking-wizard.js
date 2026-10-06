'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, Scissors, Sparkles, Star, UserRound } from 'lucide-react';

const stepLabels = ['Serviço', 'Estilo', 'Barbeiro', 'Data', 'Horário', 'Confirmar'];
const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const initials = (name) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

function getCalendarCells(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function toInputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function BookingWizard({ tenant, services, styles, barbers, initialAppointment }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState(initialAppointment?.serviceId || '');
  const [styleId, setStyleId] = useState(initialAppointment?.hairStyleId || '');
  const [barberId, setBarberId] = useState(initialAppointment?.barberId || '');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [availableDates, setAvailableDates] = useState([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [availability, setAvailability] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [confirmedAppointment, setConfirmedAppointment] = useState(null);

  const selectedService = services.find((service) => service.id === serviceId);
  const selectedStyle = styles.find((style) => style.id === styleId);
  const selectedBarber = barbers.find((barber) => barber.id === (selectedOption?.barberId || barberId));
  const calendarCells = useMemo(() => getCalendarCells(calendarMonth), [calendarMonth]);
  const today = toInputDate(new Date());
  const maximumDate = new Date();
  maximumDate.setDate(maximumDate.getDate() + 90);
  const lastBookableDate = toInputDate(maximumDate);

  useEffect(() => {
    if (step !== 3 || !serviceId) return undefined;
    const controller = new AbortController();
    const month = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`;
    const params = new URLSearchParams({ tenant: tenant.slug, month, serviceId });
    if (barberId) params.set('barberId', barberId);
    setLoadingDates(true);
    setAvailableDates([]);
    fetch(`/api/customer/availability?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível consultar o calendário.');
        setAvailableDates(result.availableDates || []);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDates(false);
      });
    return () => controller.abort();
  }, [barberId, calendarMonth, serviceId, step, tenant.slug]);

  useEffect(() => {
    if (step !== 4 || !selectedDate || !serviceId) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ tenant: tenant.slug, date: selectedDate, serviceId });
    if (barberId) params.set('barberId', barberId);
    setLoadingAvailability(true);
    setAvailability([]);
    setSelectedOption(null);
    setError('');
    fetch(`/api/customer/availability?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível consultar os horários.');
        setAvailability(result.options);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingAvailability(false);
      });
    return () => controller.abort();
  }, [barberId, selectedDate, serviceId, step, tenant.slug]);

  const chooseDate = (date) => {
    setSelectedDate(toInputDate(date));
    setStep(4);
  };

  const goNext = () => {
    setError('');
    if (step === 0 && !serviceId) return setError('Escolha um serviço para continuar.');
    if (step === 4 && !selectedOption) return setError('Escolha um horário disponível para continuar.');
    if (step === 4 && selectedOption && !barberId) setBarberId(selectedOption.barberId);
    setStep((current) => Math.min(current + 1, 5));
  };

  const confirmBooking = async () => {
    if (!selectedService || !selectedOption || !selectedDate) return;
    setBooking(true);
    setError('');
    try {
      const response = await fetch('/api/customer/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          styleId: styleId || null,
          barberId: selectedOption.barberId,
          date: selectedDate,
          time: selectedOption.time,
          ...(initialAppointment ? { rescheduleId: initialAppointment.id } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível concluir seu agendamento.');
      setConfirmedAppointment(result.appointment);
    } catch (submitError) {
      setError(submitError.message);
      if (submitError.message.toLowerCase().includes('indisponível') || submitError.message.toLowerCase().includes('reservado')) setStep(4);
    } finally {
      setBooking(false);
    }
  };

  const moveMonth = (amount) => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));

  if (confirmedAppointment) {
    const startsAt = new Date(confirmedAppointment.startsAt);
    return <main className="customer-main"><section className="booking-success"><span className="success-check"><CheckCircle2 size={27} /></span><span className="customer-eyebrow">NAVALHA STUDIO</span><h1>Agendamento confirmado!</h1><p>Seu próximo momento de cuidado já está reservado.</p><span className="success-code">CÓDIGO · {confirmedAppointment.code}</span><div className="success-details"><div><span>Serviço</span><strong>{confirmedAppointment.service.name}{confirmedAppointment.hairStyle ? ` · ${confirmedAppointment.hairStyle.name}` : ''}</strong></div><div><span>Barbeiro</span><strong>{confirmedAppointment.barber.name}</strong></div><div><span>Data</span><strong>{new Intl.DateTimeFormat('pt-BR', { timeZone: tenant.timezone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(startsAt)}</strong></div><div><span>Horário</span><strong>{new Intl.DateTimeFormat('pt-BR', { timeZone: tenant.timezone, hour: '2-digit', minute: '2-digit' }).format(startsAt)}</strong></div><div><span>Duração</span><strong>{confirmedAppointment.durationMinutes} min</strong></div><div><span>Valor</span><strong>{money(confirmedAppointment.priceCents)}</strong></div></div><div className="customer-actions" style={{ justifyContent: 'center' }}><Link className="customer-gold-button" href="/cliente/meus-agendamentos">VER MEU AGENDAMENTO <ArrowRight size={14} /></Link><Link className="customer-quiet-button" href="/cliente/minha-conta">VOLTAR PARA INÍCIO</Link></div></section></main>;
  }

  return <main className="customer-main">
    <div className="booking-page-heading"><span className="customer-eyebrow">{initialAppointment ? 'ESCOLHA UM NOVO HORÁRIO' : 'NAVALHA STUDIO · SÃO PAULO'}</span><h1 className="customer-title">{initialAppointment ? 'Reagendar horário' : 'Seu próximo corte começa aqui.'}</h1><p className="customer-subtitle">Escolha cada detalhe no seu tempo. A gente cuida do resto.</p></div>
    <div className="booking-wizard">
      <div className="wizard-main">
        <div className="wizard-steps">{stepLabels.map((label, index) => <div className={`wizard-step ${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`} key={label}><span className="wizard-step-number">{index < step ? <Check size={13} /> : index + 1}</span><span>{label}</span></div>)}</div>
        <section className="customer-panel wizard-content">
          {error && <div className="wizard-message" role="alert">{error}</div>}
          {step === 0 && <><h2>Escolha seu serviço</h2><p>Todos os preços e durações são definidos pela barbearia.</p><div className="service-choice-grid">{services.map((service) => <button className={`service-choice ${serviceId === service.id ? 'selected' : ''}`} key={service.id} onClick={() => { setServiceId(service.id); setError(''); }}><span><strong>{service.name}</strong><small>{service.description}</small></span><span className="service-choice-bottom"><strong>{money(service.priceCents)}</strong><span><Clock3 size={12} />{service.durationMinutes} min</span></span></button>)}</div></>}
          {step === 1 && <><h2>Qual estilo combina com você?</h2><p>Opcional · Escolha uma referência para o barbeiro.</p><button className={`style-choice none-style ${!styleId ? 'selected' : ''}`} onClick={() => setStyleId('')}>Ainda não escolhi um estilo <ArrowRight size={14} /></button><div className="style-choice-grid">{styles.map((style, index) => <button className={`style-choice ${styleId === style.id ? 'selected' : ''}`} key={style.id} onClick={() => setStyleId(style.id)}><span className="style-photo" style={{ backgroundImage: `linear-gradient(0deg,#15130fd9,#15130f15 80%),url('${style.imageUrl || styleImages[index % styleImages.length]}')` }} /><span className="style-copy"><strong>{style.name}</strong><small>{style.description}</small><span className="style-select">ESCOLHER ESTILO <ArrowRight size={10} /></span></span></button>)}</div></>}
          {step === 2 && <><h2>Escolha seu barbeiro</h2><p>Ou deixe a gente encontrar o melhor horário para você.</p><div className="barber-choice-grid"><button className={`barber-choice ${!barberId ? 'selected' : ''}`} onClick={() => { setBarberId(''); setSelectedOption(null); }}><span className="barber-portrait"><Sparkles size={17} /></span><span className="barber-copy"><strong>Não tenho preferência</strong><small>Mais horários disponíveis</small></span></button>{barbers.map((barber) => <button className={`barber-choice ${barberId === barber.id ? 'selected' : ''}`} key={barber.id} onClick={() => { setBarberId(barber.id); setSelectedOption(null); }}><span className="barber-portrait">{initials(barber.name)}</span><span className="barber-copy"><strong>{barber.name}</strong><small><Star size={10} fill="currentColor" /> {barber.rating.toFixed(1)} · {barber.specialties || 'Cortes clássicos'}</small></span></button>)}</div></>}
          {step === 3 && <><h2>Escolha a data</h2><p>O calendário segue a agenda real, as folgas e os bloqueios cadastrados.</p><div className="calendar-controls"><button aria-label="Mês anterior" onClick={() => moveMonth(-1)}><ArrowLeft size={14} /></button><strong>{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(calendarMonth)}</strong><button aria-label="Próximo mês" onClick={() => moveMonth(1)}><ArrowRight size={14} /></button></div>{loadingDates && <p className="calendar-loading">Consultando as datas com horários disponíveis...</p>}<div className="calendar-grid">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => <span className="calendar-weekday" key={`${day}-${index}`}>{day}</span>)}{calendarCells.map((date, index) => { const key = dateKey(date); const inMonth = date.getMonth() === calendarMonth.getMonth(); const isPast = key < today; const enabled = inMonth && !isPast && key <= lastBookableDate && availableDates.includes(key) && !loadingDates; return <button key={index} className={`calendar-day ${!inMonth ? 'blank' : ''} ${enabled ? 'available' : ''} ${selectedDate === key ? 'selected' : ''}`} disabled={!enabled} onClick={() => chooseDate(date)}>{date.getDate()}</button>; })}</div><div className="calendar-legend"><span><i /> Datas com horários disponíveis</span><small>Datas passadas, bloqueadas e sem vaga ficam desativadas.</small></div></>}
          {step === 4 && <><h2>Encontre um horário</h2><p>{selectedDate && new Intl.DateTimeFormat('pt-BR', { timeZone: tenant.timezone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${selectedDate}T12:00:00`))}</p>{loadingAvailability ? <div className="customer-empty"><Clock3 size={20} /><strong>Consultando a agenda...</strong></div> : availability.length ? <><div className="availability-summary"><span>{availability.length} opções encontradas</span><span>Disponibilidade atualizada agora</span></div><div className="time-choice-grid">{availability.map((option) => <button className={`time-choice ${selectedOption?.time === option.time && selectedOption?.barberId === option.barberId ? 'selected' : ''}`} key={`${option.time}-${option.barberId}`} onClick={() => setSelectedOption(option)}><strong>{option.time}</strong><small>{option.barberName.split(' ')[0]}</small></button>)}</div></> : !error && <div className="customer-empty"><CalendarDays size={20} /><strong>Não há horários disponíveis nesta data.</strong><p>Volte ao calendário e escolha outro dia ou profissional.</p></div>}</>}
          {step === 5 && <><h2>Confira seu horário</h2><p>Revise os detalhes antes de confirmar o agendamento.</p><div className="review-list"><div><span>Serviço</span><strong>{selectedService?.name}</strong></div><div><span>Estilo</span><strong>{selectedStyle?.name || 'Sem preferência'}</strong></div><div><span>Barbeiro</span><strong>{selectedOption?.barberName || selectedBarber?.name}</strong></div><div><span>Data</span><strong>{selectedDate && new Intl.DateTimeFormat('pt-BR', { timeZone: tenant.timezone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${selectedDate}T12:00:00`))}</strong></div><div><span>Horário</span><strong>{selectedOption?.time}</strong></div><div><span>Duração</span><strong>{selectedService?.durationMinutes} minutos</strong></div><div className="review-total"><span>Valor</span><strong>{selectedService && money(selectedService.priceCents)}</strong></div></div><p className="booking-privacy"><CheckCircle2 size={13} /> Este horário será reservado exclusivamente para você.</p></>}
          <div className="wizard-footer">{step > 0 ? <button onClick={() => { setError(''); setStep((current) => current - 1); }}><ArrowLeft size={13} /> VOLTAR</button> : <span />}{step < 5 ? <button className="next" disabled={step === 4 && (loadingAvailability || !selectedOption)} onClick={goNext}>CONTINUAR <ArrowRight size={13} /></button> : <button className="next" disabled={booking} onClick={confirmBooking}>{booking ? 'CONFIRMANDO...' : 'CONFIRMAR AGENDAMENTO'} {!booking && <Check size={13} />}</button>}</div>
        </section>
      </div>

      <aside className="customer-panel booking-summary"><div className="customer-panel-heading"><h2>Resumo</h2><Scissors size={16} /></div><div className="booking-summary-content"><div className="booking-summary-row"><span>SERVIÇO</span><strong>{selectedService?.name || 'Selecione um serviço'}</strong></div><div className="booking-summary-row"><span>ESTILO</span><strong>{selectedStyle?.name || 'Sem preferência'}</strong></div><div className="booking-summary-row"><span>BARBEIRO</span><strong>{selectedOption?.barberName || barbers.find((item) => item.id === barberId)?.name || 'Sem preferência'}</strong></div><div className="booking-summary-row"><span>DATA E HORA</span><strong>{selectedDate ? `${new Intl.DateTimeFormat('pt-BR', { timeZone: tenant.timezone, day: '2-digit', month: '2-digit' }).format(new Date(`${selectedDate}T12:00:00`))}${selectedOption ? ` · ${selectedOption.time}` : ''}` : 'Ainda não selecionadas'}</strong></div><div className="booking-summary-total"><span>TOTAL</span><strong>{selectedService ? money(selectedService.priceCents) : '—'}</strong></div></div><p className="booking-notice">O agendamento ficará associado à sua conta e será compartilhado com o profissional e a barbearia.</p></aside>
    </div>
  </main>;
}

const styleImages = [
  'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=480&q=78',
  'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=480&q=78',
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=480&q=78',
];