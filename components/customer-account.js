import Link from 'next/link';
import { CalendarDays, Clock3, Mail, MapPin, Phone, Scissors, Star, UserRound } from 'lucide-react';

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

function formatDate(date, timezone) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(date));
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export default function CustomerAccount({ user, tenant, appointments, preferredBarber }) {
  const upcoming = appointments.find((appointment) => ['PENDENTE', 'CONFIRMADO'].includes(appointment.status) && new Date(appointment.startsAt) >= new Date());
  const pastServices = Array.from(new Set(appointments.filter((appointment) => appointment.status === 'CONCLUIDO').map((appointment) => appointment.service.name)));

  return (
    <main className="customer-main">
      <section className="customer-account-heading">
        <div className="customer-profile"><span className="customer-profile-avatar">{initials(user.name)}</span><div className="customer-profile-copy"><span className="customer-eyebrow">MINHA CONTA</span><h1>Olá, {user.name.split(' ')[0]}.</h1><p>Seu próximo momento de cuidado começa por aqui.</p></div></div>
        <Link className="customer-gold-button" href="/cliente/novo-agendamento"><CalendarDays size={15} /> AGENDAR NOVO HORÁRIO</Link>
      </section>

      <div className="customer-account-grid">
        <div>
          <section className="customer-next-card">
            <span className="next-card-label"><Star size={13} /> SEU PRÓXIMO HORÁRIO</span>
            {upcoming ? <><h2>{upcoming.service.name}</h2><p>com {upcoming.barber.name} · {formatDate(upcoming.startsAt, tenant.timezone)}</p><div className="next-appointment-details"><span><Clock3 size={13} />{new Intl.DateTimeFormat('pt-BR', { timeZone: tenant.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(upcoming.startsAt))}</span><span><Scissors size={13} />{upcoming.durationMinutes} min</span><span>{money(upcoming.priceCents)}</span><span className="appointment-status">{upcoming.status}</span></div></> : <><h2>Um novo visual espera por você.</h2><p>Escolha serviço, profissional e horário em poucos passos.</p><div className="customer-actions"><Link className="customer-gold-button" href="/cliente/novo-agendamento">ESCOLHER UM HORÁRIO <CalendarDays size={14} /></Link></div></>}
          </section>

          <section className="customer-panel customer-history">
            <div className="customer-panel-heading"><h2>Visitas recentes</h2><Link href="/cliente/meus-agendamentos">Ver todos</Link></div>
            <div className="customer-history-list">{appointments.slice(0, 4).map((appointment) => { const date = new Date(appointment.startsAt); return <div className="customer-history-row" key={appointment.id}><span className="history-date-badge"><strong>{new Intl.DateTimeFormat('pt-BR', { timeZone: tenant.timezone, day: '2-digit' }).format(date)}</strong><small>{new Intl.DateTimeFormat('pt-BR', { timeZone: tenant.timezone, month: 'short' }).format(date).replace('.', '')}</small></span><span className="history-copy"><strong>{appointment.service.name}</strong><small>{appointment.barber.name} · {appointment.status}</small></span><strong className="history-price">{money(appointment.priceCents)}</strong></div>; })}{appointments.length === 0 && <div className="customer-empty"><CalendarDays size={20} /><strong>Seu histórico começa com um bom corte.</strong><p>Quando concluir seu primeiro atendimento, ele aparecerá aqui.</p></div>}</div>
          </section>
        </div>

        <aside className="customer-panel">
          <div className="customer-panel-heading"><h2>Seus dados</h2></div>
          <div className="customer-info-list"><div className="customer-info-row"><span><UserRound size={13} /> Nome</span><strong>{user.name}</strong></div><div className="customer-info-row"><span><Mail size={13} /> E-mail</span><strong>{user.email}</strong></div><div className="customer-info-row"><span><Phone size={13} /> WhatsApp</span><strong>{user.phone || 'Não informado'}</strong></div><div className="customer-info-row"><span><MapPin size={13} /> Barbearia</span><strong>{tenant.name}</strong></div><div className="customer-info-row"><span><Star size={13} /> Preferido</span><strong>{preferredBarber?.name || 'Ainda sem preferência'}</strong></div></div>
          <div className="customer-panel-heading"><h2>Serviços realizados</h2></div>
          <div className="customer-info-list">{pastServices.length ? pastServices.map((service) => <div className="customer-info-row" key={service}><span><Scissors size={13} /> Serviço</span><strong>{service}</strong></div>) : <div className="customer-info-row"><span>Finalize sua primeira visita para ver seus serviços aqui.</span></div>}</div>
          <div className="customer-info-list"><Link className="customer-quiet-button" href="/cliente/meus-agendamentos">Meus agendamentos <CalendarDays size={13} /></Link></div>
        </aside>
      </div>
    </main>
  );
}