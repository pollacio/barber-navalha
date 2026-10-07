'use client';

import './saas.css';
import './saas-theme.css';
import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Command,
  CreditCard,
  Ellipsis,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings2,
  Scissors,
  Sparkles,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react';

const services = [
  { name: 'Corte degradê', duration: '45 min', price: 65, color: 'mint' },
  { name: 'Corte clássico', duration: '40 min', price: 55, color: 'peach' },
  { name: 'Barba completa', duration: '30 min', price: 45, color: 'lavender' },
  { name: 'Corte + barba', duration: '75 min', price: 95, color: 'yellow' },
];

const team = [
  { name: 'Lucas Ferreira', initials: 'LF', role: 'Barbeiro', color: 'mint' },
  { name: 'Gabriel Santos', initials: 'GS', role: 'Barbeiro', color: 'peach' },
  { name: 'Rafael Lima', initials: 'RL', role: 'Barbeiro', color: 'lavender' },
];

const navItems = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'clients', label: 'Clientes', icon: UsersRound },
  { id: 'services', label: 'Serviços', icon: Scissors },
  { id: 'team', label: 'Equipe', icon: UsersRound },
  { id: 'finance', label: 'Financeiro', icon: Wallet },
];

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getInitialAppointments() {
  const today = new Date();
  const key = dateKey(today);
  return [
    { id: 1, time: '09:00', name: 'Pedro Henrique', service: 'Corte degradê', barber: 'Lucas Ferreira', price: 65, status: 'Concluído', date: key, initials: 'PH' },
    { id: 2, time: '09:45', name: 'André Martins', service: 'Barba completa', barber: 'Gabriel Santos', price: 45, status: 'Em atendimento', date: key, initials: 'AM' },
    { id: 3, time: '10:30', name: 'João Victor', service: 'Corte + barba', barber: 'Rafael Lima', price: 95, status: 'Confirmado', date: key, initials: 'JV' },
    { id: 4, time: '11:45', name: 'Marcos Oliveira', service: 'Corte clássico', barber: 'Lucas Ferreira', price: 55, status: 'Confirmado', date: key, initials: 'MO' },
    { id: 5, time: '13:00', name: 'Felipe Costa', service: 'Corte degradê', barber: 'Gabriel Santos', price: 65, status: 'Aguardando', date: key, initials: 'FC' },
    { id: 6, time: '14:15', name: 'Bruno Almeida', service: 'Corte + barba', barber: 'Rafael Lima', price: 95, status: 'Confirmado', date: key, initials: 'BA' },
    { id: 7, time: '15:30', name: 'Caio Ribeiro', service: 'Corte clássico', barber: 'Lucas Ferreira', price: 55, status: 'Confirmado', date: key, initials: 'CR' },
  ];
}

function makeInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

export default function Home() {
  const [activeView, setActiveView] = useState('overview');
  const [appointments, setAppointments] = useState(getInitialAppointments);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showBooking, setShowBooking] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [messages, setMessages] = useState([
    { from: 'assistant', text: 'Oi! Sou a assistente da Navalha. Posso resumir sua agenda, analisar o faturamento ou sugerir ações para o dia.' },
  ]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantStatus, setAssistantStatus] = useState('demo');
  const [assistantLoading, setAssistantLoading] = useState(false);

  const selectedKey = dateKey(selectedDate);
  const todaysAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.date === selectedKey).sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, selectedKey],
  );
  const filteredAppointments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return todaysAppointments.filter((appointment) => {
      const matchesSearch = !query || `${appointment.name} ${appointment.service} ${appointment.barber}`.toLowerCase().includes(query);
      return matchesSearch && (statusFilter === 'Todos' || appointment.status === statusFilter);
    });
  }, [search, statusFilter, todaysAppointments]);
  const completedAppointments = appointments.filter((appointment) => appointment.status === 'Concluído');
  const currentRevenue = completedAppointments.reduce((total, appointment) => total + appointment.price, 0);
  const navLabel = navItems.find((item) => item.id === activeView)?.label || 'Visão geral';

  const showToast = (text) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 2600);
  };

  const changeAppointmentStatus = (id) => {
    const appointment = appointments.find((item) => item.id === id);
    if (!appointment) return;
    const nextStatus = appointment.status === 'Concluído' ? 'Confirmado' : 'Concluído';
    setAppointments((current) => current.map((appointment) => {
      if (appointment.id !== id) return appointment;
      return { ...appointment, status: nextStatus };
    }));
    showToast(nextStatus === 'Concluído' ? 'Atendimento concluído.' : 'Agendamento reaberto.');
  };

  const createAppointment = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const clientName = String(form.get('client') || '').trim();
    const chosenService = services.find((service) => service.name === form.get('service')) || services[0];
    const appointmentDate = String(form.get('date') || selectedKey);
    const appointmentTime = String(form.get('time') || '16:00');
    const barberName = String(form.get('barber') || team[0].name);
    setAppointments((current) => [...current, {
      id: Date.now(),
      time: appointmentTime,
      name: clientName,
      service: chosenService.name,
      barber: barberName,
      price: chosenService.price,
      status: 'Confirmado',
      date: appointmentDate,
      initials: makeInitials(clientName),
    }]);
    setSelectedDate(new Date(`${appointmentDate}T12:00:00`));
    setActiveView('agenda');
    setShowBooking(false);
    showToast('Agendamento criado com sucesso.');
  };

  const sendAssistantMessage = async (suggestion) => {
    const question = (suggestion ?? assistantInput).trim();
    if (!question || assistantLoading) return;
    const normalized = question.toLowerCase();
    let answer;
    if (/fatur|receita|venda|caixa|finance/.test(normalized)) {
      answer = `Até agora, ${completedAppointments.length} atendimento${completedAppointments.length === 1 ? '' : 's'} concluído${completedAppointments.length === 1 ? '' : 's'} somam ${money(currentRevenue)}. O serviço mais procurado hoje é corte degradê. Sugestão: ofereça um combo de barba para aumentar o valor médio por visita.`;
    } else if (/agenda|hor.rio|atendimento|cliente|ocupad/.test(normalized)) {
      const confirmed = todaysAppointments.filter((appointment) => appointment.status !== 'Concluído').length;
      answer = `Você tem ${todaysAppointments.length} horários na agenda de ${formatLongDate(selectedDate)}; ${confirmed} ainda estão em andamento ou por vir. O próximo é às ${todaysAppointments.find((appointment) => appointment.status !== 'Concluído')?.time || 'sem horário pendente'}.`;
    } else if (/amanh/.test(normalized)) {
      const tomorrow = new Date(selectedDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const count = appointments.filter((appointment) => appointment.date === dateKey(tomorrow)).length;
      answer = `Para amanhã, ${formatLongDate(tomorrow)}, há ${count} agendamento${count === 1 ? '' : 's'} cadastrado${count === 1 ? '' : 's'}. Posso ajudar a planejar uma campanha para preencher os horários livres.`;
    } else if (/marketing|divulg|instagram|promo|movimento|lot/.test(normalized)) {
      answer = 'Uma boa ação para hoje: publique um antes e depois de corte degradê e ofereça um adicional de barba nos horários com menor procura. Posso sugerir um texto curto para a campanha também.';
    } else {
      answer = `Posso ajudar com agenda, faturamento e ideias para atrair clientes. Hoje há ${todaysAppointments.length} horários e ${money(currentRevenue)} em atendimentos concluídos.`;
    }
    setMessages((current) => [...current, { from: 'user', text: question }]);
    setAssistantInput('');
    setAssistantLoading(true);
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          context: {
            date: formatLongDate(selectedDate),
            revenue: currentRevenue,
            appointments: todaysAppointments.map(({ time, name, service, barber, price, status }) => ({ time, name, service, barber, price, status })),
          },
        }),
      });
      const result = await response.json();
      if (response.status === 503) {
        setAssistantStatus('demo');
      } else if (!response.ok) {
        throw new Error(result.error || 'Falha ao consultar a IA.');
      } else {
        answer = result.reply;
        setAssistantStatus('connected');
      }
    } catch {
      setAssistantStatus('error');
      answer = 'Não consegui acessar o serviço de IA agora. Verifique a conexão e tente novamente.';
    } finally {
      setAssistantLoading(false);
    }
    if (!answer) {
      if (/fatur|receita|venda|caixa|finance/.test(normalized)) {
        answer = `Até agora, ${completedAppointments.length} atendimento${completedAppointments.length === 1 ? '' : 's'} concluído${completedAppointments.length === 1 ? '' : 's'} somam ${money(currentRevenue)}. O serviço mais procurado hoje é corte degradê. Sugestão: ofereça um combo de barba para aumentar o valor médio por visita.`;
      } else if (/agenda|hor.rio|atendimento|cliente|ocupad/.test(normalized)) {
        const confirmed = todaysAppointments.filter((appointment) => appointment.status !== 'Concluído').length;
        answer = `Você tem ${todaysAppointments.length} horários na agenda de ${formatLongDate(selectedDate)}; ${confirmed} ainda estão em andamento ou por vir. O próximo é às ${todaysAppointments.find((appointment) => appointment.status !== 'Concluído')?.time || 'sem horário pendente'}.`;
      } else if (/amanh/.test(normalized)) {
        const tomorrow = new Date(selectedDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const count = appointments.filter((appointment) => appointment.date === dateKey(tomorrow)).length;
        answer = `Para amanhã, ${formatLongDate(tomorrow)}, há ${count} agendamento${count === 1 ? '' : 's'} cadastrado${count === 1 ? '' : 's'}. Posso ajudar a planejar uma campanha para preencher os horários livres.`;
      } else if (/marketing|divulg|instagram|promo|movimento|lot/.test(normalized)) {
        answer = 'Uma boa ação para hoje: publique um antes e depois de corte degradê e ofereça um adicional de barba nos horários com menor procura. Posso sugerir um texto curto para a campanha também.';
      } else {
        answer = `Posso ajudar com agenda, faturamento e ideias para atrair clientes. Hoje há ${todaysAppointments.length} horários e ${money(currentRevenue)} em atendimentos concluídos.`;
      }
    }
    setMessages((current) => [...current, { from: 'assistant', text: answer }]);
  };

  const moveDate = (days) => {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  return (
    <main className="saas-app">
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <a className="workspace-brand" href="#inicio" onClick={(event) => event.preventDefault()}>
          <span className="brand-symbol"><Scissors size={20} strokeWidth={2.2} /></span>
          <span><strong>navalha</strong><small>STUDIO & BARBER</small></span>
        </a>

        <div className="workspace-switcher">
          <span className="shop-avatar">N</span>
          <span className="workspace-copy"><strong>Navalha Studio</strong><small>Plano profissional</small></span>
          <ChevronDown size={16} />
        </div>

        <div className="nav-caption">MENU PRINCIPAL</div>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} title={label} aria-label={label} className={`sidebar-link ${activeView === id ? 'active' : ''}`} onClick={() => { setActiveView(id); setMobileMenuOpen(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{id === 'agenda' && <span className="nav-count">{todaysAppointments.length}</span>}
            </button>
          ))}
        </nav>

        <div className="nav-caption">ACESSO PÚBLICO</div>
        <nav className="sidebar-nav" aria-label="Navegação pública">
          <a href="/cliente/novo-agendamento" className="sidebar-link" title="Agendar horário online como cliente">
            <Sparkles size={18} strokeWidth={1.8} /><span>Agendar Online</span>
          </a>
          <a href="/cliente/login" className="sidebar-link" title="Área restrita do cliente">
            <UsersRound size={18} strokeWidth={1.8} /><span>Área do Cliente</span>
          </a>
          <a href="/barbeiro/login" className="sidebar-link" title="Painel de atendimento do barbeiro">
            <Scissors size={18} strokeWidth={1.8} /><span>Portal Barbeiro</span>
          </a>
          <a href="/admin/gestao" className="sidebar-link" title="Painel administrativo da barbearia">
            <Settings2 size={18} strokeWidth={1.8} /><span>Gestão Master</span>
          </a>
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-ai-card">
          <div className="ai-card-icon"><Sparkles size={18} /></div>
          <strong>Copiloto IA v2.5</strong>
          <p>Insights em tempo real com inteligência preditiva.</p>
          <button onClick={() => setAssistantOpen(true)}>Consultar IA Neural <ChevronRight size={14} /></button>
        </div>
        <button className="sidebar-link settings-link" title="Abrir configurações e gestão" onClick={() => { window.location.href = '/admin/gestao'; }}><Settings2 size={18} /><span>Configurações</span></button>
        <div className="profile-mini"><div className="profile-avatar">RM</div><div><strong>Rafael Mendes</strong><small>Administrador</small></div><Ellipsis size={19} /></div>
      </aside>

      <section className="main-area">
        <header className="topbar saas-topbar">
          <button className="mobile-menu-toggle" aria-label="Abrir navegação" onClick={() => setMobileMenuOpen((open) => !open)}><Menu size={20} /></button>
          <div className="breadcrumb"><span style={{ color: '#00f2fe' }}>Navalha SaaS v2.5</span><ChevronRight size={14} /><strong>{navLabel}</strong></div>
          <div className="topbar-tools">
            <label className="global-search"><Search size={16} /><input aria-label="Buscar" placeholder="Buscar no sistema..." onChange={(event) => setSearch(event.target.value)} /><kbd><Command size={11} /> K</kbd></label>
            <button className="icon-button notification-button" aria-label="Notificações" onClick={() => showToast('Você está em dia com as notificações.')}><span className="notification-dot" /> <MessageCircle size={18} /></button>
            <button className="top-avatar" aria-label="Perfil de Rafael Mendes">RM</button>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="public-hub-banner">
            <div className="hub-status-chip">
              <span className="live-ping" />
              <strong>SISTEMA PÚBLICO ATIVO</strong>
              <span>· Experimente todas as áreas do SaaS em tempo real:</span>
            </div>
            <div className="hub-links">
              <a href="/cliente/novo-agendamento" className="hub-link book">
                <Sparkles size={14} /> <span>Agendar Online (Público)</span>
              </a>
              <a href="/cliente/login" className="hub-link client">
                <UsersRound size={14} /> <span>Área do Cliente</span>
              </a>
              <a href="/barbeiro/login" className="hub-link barber">
                <Scissors size={14} /> <span>Portal Barbeiro</span>
              </a>
              <a href="/admin/gestao" className="hub-link admin">
                <Settings2 size={14} /> <span>Painel Gestão</span>
              </a>
            </div>
          </div>

          <div className="page-heading">
            <div><div className="date-eyebrow"><span className="live-dot" /> SISTEMA TECH ONLINE <span>·</span> {new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()).toUpperCase()} <span>·</span> <span style={{ color: '#00f2fe' }}>DEMO PÚBLICA</span></div><h1>{activeView === 'overview' ? 'Bom dia, Rafael' : navLabel}<span>{activeView === 'overview' ? '.' : ''}</span></h1><p>{activeView === 'overview' ? 'Monitoramento inteligente e indicadores em tempo real da barbearia.' : `Acompanhe e gerencie ${navLabel.toLowerCase()} do seu negócio.`}</p></div>
            <button className="primary-button" onClick={() => setShowBooking(true)}><Plus size={17} /> Novo agendamento</button>
          </div>

          {activeView === 'overview' && <Overview
            appointments={todaysAppointments}
            revenue={currentRevenue}
            onNew={() => setShowBooking(true)}
            onStatusChange={changeAppointmentStatus}
            onOpenAgenda={() => setActiveView('agenda')}
            onOpenServices={() => setActiveView('services')}
            onOpenAssistant={() => setAssistantOpen(true)}
          />}

          {activeView === 'agenda' && <AgendaView
            date={selectedDate}
            appointments={filteredAppointments}
            statusFilter={statusFilter}
            onFilter={setStatusFilter}
            onDateMove={moveDate}
            onDateToday={() => setSelectedDate(new Date())}
            onStatusChange={changeAppointmentStatus}
            onNew={() => setShowBooking(true)}
          />}

          {activeView === 'clients' && <ClientsView appointments={appointments} search={search} />}
          {activeView === 'services' && <ServicesView onNew={() => showToast('Edição de serviços disponível em breve.')} />}
          {activeView === 'team' && <TeamView onNew={() => showToast('Convites para equipe disponíveis em breve.')} />}
          {activeView === 'finance' && <FinanceView revenue={currentRevenue} appointments={completedAppointments} />}
        </div>
      </section>

      {assistantOpen && <AssistantPanel
        messages={messages}
        input={assistantInput}
        onInput={setAssistantInput}
        onSend={sendAssistantMessage}
        status={assistantStatus}
        loading={assistantLoading}
        onClose={() => setAssistantOpen(false)}
      />}
      {showBooking && <BookingModal onClose={() => setShowBooking(false)} onSubmit={createAppointment} selectedDate={selectedKey} />}
      {toast && <div className="toast-message"><Check size={16} />{toast}</div>}
    </main>
  );
}

function Overview({ appointments, revenue, onNew, onStatusChange, onOpenAgenda, onOpenServices, onOpenAssistant }) {
  const completed = appointments.filter((appointment) => appointment.status === 'Concluído').length;
  const occupancy = Math.min(Math.round((appointments.length / 12) * 100), 100);
  const chartHeights = [33, 48, 40, 62, 46, 72, 52, 81, 56, 68, 44, 90, 59, 74, 48, 86, 64, 77, 54, 95, 60, 72, 50, 83, 58, 69, 45, 87];
  return (
    <>
      <div className="metric-grid">
        <MetricCard label="Faturamento do dia" value={money(revenue)} change="12,8%" icon={<CircleDollarSign size={19} />} tone="green" trend="up" note="vs. mesmo dia na semana passada" />
        <MetricCard label="Agendamentos" value={String(appointments.length).padStart(2, '0')} change="8,2%" icon={<CalendarDays size={19} />} tone="blue" trend="up" note="vs. mesmo dia na semana passada" />
        <MetricCard label="Clientes atendidos" value={String(completed).padStart(2, '0')} change="3,1%" icon={<UsersRound size={19} />} tone="orange" trend="up" note="vs. mesmo dia na semana passada" />
        <MetricCard label="Taxa de ocupação" value={`${occupancy}%`} change="4,6%" icon={<Clock3 size={19} />} tone="violet" trend="down" note="vs. mesmo dia na semana passada" />
      </div>

      <div className="dashboard-columns">
        <section className="panel agenda-panel">
          <div className="panel-heading"><div><span className="section-kicker">ACOMPANHAMENTO</span><h2>Agenda de hoje</h2></div><button className="subtle-button" onClick={onOpenAgenda}>Ver agenda <ChevronRight size={15} /></button></div>
          <div className="agenda-summary"><div className="today-date"><span className="calendar-icon"><CalendarDays size={17} /></span><strong>{formatLongDate(new Date())}</strong></div><span className="open-status"><span /> Loja aberta</span></div>
          <div className="appointment-list">
            {appointments.slice(0, 5).map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} onStatusChange={onStatusChange} />)}
            {!appointments.length && <EmptyState title="Agenda livre por aqui" detail="Crie um agendamento para preencher este horário." />}
          </div>
          <button className="add-appointment-row" onClick={onNew}><Plus size={16} /> Adicionar agendamento</button>
        </section>

        <div className="right-column">
          <section className="panel revenue-panel">
            <div className="panel-heading"><div><span className="section-kicker">DESEMPENHO</span><h2>Visão de receita</h2></div><button className="select-button">Esta semana <ChevronDown size={14} /></button></div>
            <div className="revenue-total"><strong>{money(revenue * 5.4 || 1280)}</strong><span><ArrowUpRight size={14} /> 12,8%</span></div>
            <div className="revenue-chart" aria-label="Gráfico de receita crescente"><div className="chart-guides"><i /><i /><i /></div><div className="chart-bars">{chartHeights.map((height, index) => <span key={index} className={index > 21 ? 'bar-highlight' : ''} style={{ height: `${height}%` }} />)}</div></div>
            <div className="chart-labels"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span><span>DOM</span></div>
          </section>

          <section className="ai-insight-card">
            <div className="insight-topline"><span><Sparkles size={15} /> INSIGHT DA IA</span><span className="demo-tag">DEMO</span></div>
            <h3>Um bom dia para combos.</h3>
            <p>Combos de corte + barba representam <strong>38% do faturamento</strong> nesta semana. Ofereça o serviço aos clientes de corte de hoje.</p>
            <button onClick={onOpenAssistant}>Explorar insight <ArrowUpRight size={15} /></button>
          </section>
        </div>
      </div>

      <div className="lower-grid">
        <section className="panel service-panel">
          <div className="panel-heading"><div><span className="section-kicker">SEUS MAIS PEDIDOS</span><h2>Serviços populares</h2></div><button className="subtle-button" onClick={onOpenServices}>Ver serviços <ChevronRight size={15} /></button></div>
          <div className="popular-services">{services.slice(0, 3).map((service, index) => <div className="popular-service" key={service.name}><span className={`service-number ${service.color}`}>0{index + 1}</span><span className="popular-service-name"><strong>{service.name}</strong><small>{service.duration}</small></span><span className="service-progress"><i style={{ width: `${78 - index * 17}%` }} /></span><strong className="popular-price">{money(service.price)}</strong></div>)}</div>
        </section>
        <section className="panel team-status-panel">
          <div className="panel-heading"><div><span className="section-kicker">NO SALÃO</span><h2>Equipe hoje</h2></div><span className="team-online"><span /> 3 ativos</span></div>
          <div className="team-status-list">{team.map((member, index) => <div className="team-status" key={member.name}><span className={`person-avatar ${member.color}`}>{member.initials}</span><span className="team-person"><strong>{member.name}</strong><small>{index === 1 ? 'Em atendimento' : index === 0 ? 'Próximo às 10:30' : 'Disponível agora'}</small></span><span className={`presence ${index === 1 ? 'busy' : ''}`} /></div>)}</div>
        </section>
      </div>
    </>
  );
}

function MetricCard({ label, value, change, icon, tone, trend, note }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><div className="metric-value">{value}</div><div className="metric-note"><span className={`metric-change ${trend}`}>{trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{change}</span><span>{note}</span></div></article>;
}

function AppointmentRow({ appointment, onStatusChange }) {
  const actionLabel = appointment.status === 'Concluído' ? 'Reabrir atendimento' : 'Marcar como concluído';
  return <div className="appointment-row"><div className="appointment-time"><strong>{appointment.time}</strong><span className="timeline-line" /></div><div className={`person-avatar ${appointment.initials.length > 2 ? 'mint' : ['mint', 'peach', 'lavender', 'yellow'][appointment.id % 4]}`}>{appointment.initials}</div><div className="appointment-detail"><strong>{appointment.name}</strong><span>{appointment.service}<i />{appointment.barber.split(' ')[0]}</span></div><span className={`appointment-status ${appointment.status.toLowerCase().replaceAll(' ', '-')}`}>{appointment.status}</span><button className="row-action" title={actionLabel} aria-label={actionLabel} onClick={() => onStatusChange(appointment.id)}><Check size={16} /></button></div>;
}

function AgendaView({ date, appointments, statusFilter, onFilter, onDateMove, onDateToday, onStatusChange, onNew }) {
  return <section className="panel full-panel agenda-page"><div className="agenda-page-toolbar"><div className="date-switcher"><button aria-label="Dia anterior" onClick={() => onDateMove(-1)}><ChevronLeft size={18} /></button><strong>{formatLongDate(date)}</strong><button aria-label="Próximo dia" onClick={() => onDateMove(1)}><ChevronRight size={18} /></button><button className="today-button" onClick={onDateToday}>Hoje</button></div><button className="primary-button" onClick={onNew}><Plus size={17} /> Novo agendamento</button></div><div className="filter-row"><div className="filter-tabs">{['Todos', 'Confirmado', 'Em atendimento', 'Concluído'].map((filter) => <button key={filter} className={statusFilter === filter ? 'selected' : ''} onClick={() => onFilter(filter)}>{filter}</button>)}</div><span className="results-count">{appointments.length} horários</span></div><div className="full-agenda-list">{appointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} onStatusChange={onStatusChange} />)}{appointments.length === 0 && <EmptyState title="Nenhum horário encontrado" detail="Tente outra data ou ajuste os filtros da agenda." />}</div></section>;
}

function ClientsView({ appointments, search }) {
  const uniqueClients = Array.from(new Map(appointments.map((appointment) => [appointment.name, appointment])).values()).filter((client) => client.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="panel full-panel"><div className="panel-heading"><div><span className="section-kicker">RELACIONAMENTO</span><h2>Clientes recentes</h2></div><span className="results-count">{uniqueClients.length} clientes</span></div><div className="client-table"><div className="table-header"><span>CLIENTE</span><span>ÚLTIMO SERVIÇO</span><span>BARBEIRO</span><span>VALOR</span><span>STATUS</span></div>{uniqueClients.map((client, index) => <div className="client-table-row" key={client.id}><span className="client-name"><span className={`person-avatar ${['mint', 'peach', 'lavender', 'yellow'][index % 4]}`}>{client.initials}</span><strong>{client.name}</strong></span><span>{client.service}</span><span>{client.barber}</span><strong>{money(client.price)}</strong><span className={`appointment-status ${client.status.toLowerCase().replaceAll(' ', '-')}`}>{client.status}</span></div>)}</div>{!uniqueClients.length && <EmptyState title="Nenhum cliente encontrado" detail="Os clientes aparecerão aqui após os primeiros agendamentos." />}</section>;
}

function ServicesView({ onNew }) {
  return <div className="management-grid">{services.map((service, index) => <article className="panel management-card" key={service.name}><span className={`service-number ${service.color}`}>0{index + 1}</span><h2>{service.name}</h2><p><Clock3 size={15} />{service.duration}</p><strong>{money(service.price)}</strong><button className="subtle-button" onClick={onNew}>Editar serviço <ChevronRight size={15} /></button></article>)}</div>;
}

function TeamView({ onNew }) {
  return <div className="management-grid">{team.map((member, index) => <article className="panel management-card member-card" key={member.name}><span className={`person-avatar large ${member.color}`}>{member.initials}</span><h2>{member.name}</h2><p>{member.role} · {index === 1 ? 'Em atendimento' : 'Disponível'}</p><div className="member-stats"><span><strong>{[28, 24, 19][index]}</strong> atendimentos</span><span><strong>{['4,9', '4,8', '5,0'][index]}</strong> avaliação</span></div><button className="subtle-button" onClick={onNew}>Ver profissional <ChevronRight size={15} /></button></article>)}</div>;
}

function FinanceView({ revenue, appointments }) {
  return <><div className="metric-grid finance-metrics"><MetricCard label="Faturamento registrado" value={money(revenue)} change="12,8%" icon={<CircleDollarSign size={19} />} tone="green" trend="up" note="vs. semana passada" /><MetricCard label="Atendimentos concluídos" value={String(appointments.length).padStart(2, '0')} change="8,2%" icon={<CheckCheck size={19} />} tone="blue" trend="up" note="no período selecionado" /><MetricCard label="Ticket médio" value={money(appointments.length ? revenue / appointments.length : 0)} change="5,4%" icon={<CreditCard size={19} />} tone="orange" trend="up" note="vs. semana passada" /><MetricCard label="Meio de pagamento" value="Pix" change="62%" icon={<Wallet size={19} />} tone="violet" trend="up" note="dos pagamentos" /></div><section className="panel finance-note"><span className="metric-icon green"><CircleDollarSign size={19} /></span><div><h2>Resumo financeiro demonstrativo</h2><p>Os números são calculados a partir dos agendamentos de exemplo e das ações feitas nesta sessão. Conecte um banco de dados para persistir transações reais.</p></div></section></>;
}

function AssistantPanel({ messages, input, onInput, onSend, status, loading, onClose }) {
  const statusLabel = status === 'connected' ? 'IA conectada' : status === 'error' ? 'Serviço indisponível' : 'Modo demonstração';
  return <div className="assistant-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="assistant-panel" role="dialog" aria-modal="true" aria-label="Assistente com IA"><header className="assistant-header"><span className="assistant-mark"><Sparkles size={18} /></span><div><strong>Copiloto Navalha</strong><small><span /> {statusLabel}</small></div><button className="icon-button" aria-label="Fechar assistente" onClick={onClose}><X size={18} /></button></header><div className="assistant-context"><Sparkles size={15} /><span>Respostas contextualizadas com a agenda e o faturamento.</span></div><div className="assistant-conversation">{messages.map((message, index) => <div className={`chat-message ${message.from}`} key={`${index}-${message.from}`}>{message.from === 'assistant' && <span className="chat-sparkle"><Sparkles size={13} /></span>}{message.text}</div>)}{loading && <div className="chat-message assistant">Consultando a IA...</div>}</div><div className="assistant-prompts"><span>EXPERIMENTE</span><button disabled={loading} onClick={() => onSend('Como está minha agenda hoje?')}>Resumo da agenda</button><button disabled={loading} onClick={() => onSend('Como está meu faturamento?')}>Analisar faturamento</button><button disabled={loading} onClick={() => onSend('Me dê uma ideia de marketing')}>Ideia de marketing</button></div><form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); onSend(); }}><input value={input} onChange={(event) => onInput(event.target.value)} placeholder="Pergunte sobre sua barbearia..." aria-label="Mensagem para o copiloto" /><button type="submit" aria-label="Enviar mensagem" disabled={loading}><Send size={17} /></button></form><div className="assistant-footnote">{status === 'connected' ? 'OpenAI conectado · chave protegida no servidor' : status === 'error' ? 'Não foi possível conectar à IA.' : 'Configure OPENAI_API_KEY para ativar a IA real.'}</div></section></div>;
}

function BookingModal({ onClose, onSubmit, selectedDate }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title"><header className="modal-header"><div><span className="section-kicker">NOVO HORÁRIO</span><h2 id="booking-title">Criar agendamento</h2></div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={19} /></button></header><form onSubmit={onSubmit}><label>Nome do cliente<input name="client" required autoFocus placeholder="Ex.: Thiago Almeida" /></label><div className="form-row"><label>Serviço<select name="service">{services.map((service) => <option key={service.name}>{service.name}</option>)}</select></label><label>Profissional<select name="barber">{team.map((member) => <option key={member.name}>{member.name}</option>)}</select></label></div><div className="form-row"><label>Data<input type="date" name="date" defaultValue={selectedDate} required /></label><label>Horário<input type="time" name="time" defaultValue="16:00" required /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button"><Check size={16} /> Confirmar agendamento</button></div></form></section></div>;
}

function EmptyState({ title, detail }) {
  return <div className="empty-state"><span><CalendarDays size={20} /></span><strong>{title}</strong><p>{detail}</p></div>;
}