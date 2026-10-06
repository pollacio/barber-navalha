'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Check, Clock3, Images, Pencil, Scissors, Settings2, Sparkles, UsersRound, Wallet } from 'lucide-react';

const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const statuses = ['PENDENTE', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU'];
const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const formatDate = (date, timezone) => new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
const minuteTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export default function AdminWorkspace({ initial }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState('Agenda');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [editKind, setEditKind] = useState('service');
  const [editId, setEditId] = useState('');

  const request = async (url, method = 'GET', payload) => {
    const response = await fetch(url, { method, ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.');
    return result;
  };

  const refreshCatalog = async () => {
    const catalog = await request('/api/admin/catalog');
    setData((current) => ({ ...current, ...catalog }));
  };

  const submitCatalog = async (event, kind) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    payload.kind = kind;
    if (kind === 'service') payload.priceCents = Math.round(Number(payload.price) * 100);
    try {
      await request('/api/admin/catalog', 'POST', payload);
      await refreshCatalog();
      event.currentTarget.reset();
      setMessage(kind === 'service' ? 'Serviço adicionado.' : kind === 'style' ? 'Estilo adicionado.' : 'Barbeiro adicionado.');
    } catch (error) { setMessage(error.message); }
    setBusy(false);
  };

  const toggleCatalogItem = async (kind, item) => {
    const message = item.active ? 'Desativar este cadastro?' : 'Ativar este cadastro?';
    if (typeof window !== 'undefined' && !window.confirm(message)) return;
    try {
      await request(`/api/admin/catalog/${item.id}`, item.active ? 'DELETE' : 'PATCH', item.active ? undefined : { kind, active: true });
      await refreshCatalog();
      setMessage(item.active ? 'Cadastro desativado.' : 'Cadastro ativado.');
    } catch (error) { setMessage(error.message); }
  };

  const updateAppointment = async (appointment, status) => {
    try {
      await request('/api/admin/appointments', 'PATCH', { id: appointment.id, status });
      setData((current) => ({ ...current, appointments: current.appointments.map((item) => item.id === appointment.id ? { ...item, status } : item) }));
      setMessage('Status do agendamento atualizado.');
    } catch (error) { setMessage(error.message); }
  };

  const saveHours = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const isOpen = form.get('isOpen') === 'on';
    try {
      await request('/api/admin/hours', 'POST', { scope: form.get('scope'), barberId: form.get('barberId') || undefined, dayOfWeek: Number(form.get('dayOfWeek')), start: form.get('start'), end: form.get('end'), isOpen });
      const hours = await request('/api/admin/hours');
      setData((current) => ({ ...current, ...hours }));
      setMessage('Horário de funcionamento atualizado.');
    } catch (error) { setMessage(error.message); }
  };

  const addBlock = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = form.get('date');
    try {
      await request('/api/admin/blocked-times', 'POST', { barberId: form.get('barberId') || null, startsAt: new Date(`${date}T${form.get('start')}`).toISOString(), endsAt: new Date(`${date}T${form.get('end')}`).toISOString(), reason: form.get('reason') });
      setData((current) => ({ ...current, blockedTimes: [...current.blockedTimes] }));
      setMessage('Bloqueio criado.');
    } catch (error) { setMessage(error.message); }
  };

  const removeBlock = async (id) => {
    try {
      await request(`/api/admin/blocked-times?id=${encodeURIComponent(id)}`, 'DELETE');
      setData((current) => ({ ...current, blockedTimes: current.blockedTimes.filter((block) => block.id !== id) }));
      setMessage('Bloqueio removido.');
    } catch (error) { setMessage(error.message); }
  };

  const saveGallery = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await request('/api/admin/gallery', 'POST', Object.fromEntries(form.entries()));
      const result = await request('/api/admin/gallery');
      setData((current) => ({ ...current, gallery: result.gallery }));
      event.currentTarget.reset();
      setMessage('Imagem adicionada à galeria.');
    } catch (error) { setMessage(error.message); }
  };

  const saveTenant = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    if (payload.cancelNoticeHours !== undefined) payload.cancelNoticeHours = Number(payload.cancelNoticeHours);
    if (form.has('aiEnabled')) payload.aiEnabled = form.get('aiEnabled') === 'on';
    try {
      const result = await request('/api/admin/settings', 'PATCH', payload);
      setData((current) => ({ ...current, tenant: result.tenant }));
      setMessage('Informações da barbearia salvas.');
    } catch (error) { setMessage(error.message); }
  };

  const saveCatalogEdit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { kind: editKind, name: form.get('name'), description: form.get('description') || '', specialties: form.get('specialties') || '', bio: form.get('bio') || '' };
    if (editKind === 'service') {
      payload.priceCents = Math.round(Number(form.get('price')) * 100);
      payload.durationMinutes = Number(form.get('durationMinutes'));
      payload.imageUrl = form.get('imageUrl') || null;
    }
    if (editKind === 'style') {
      payload.serviceId = form.get('serviceId') || null;
      payload.imageUrl = form.get('imageUrl') || null;
    }
    try {
      await request(`/api/admin/catalog/${editItem.id}`, 'PATCH', payload);
      await refreshCatalog();
      setMessage('Cadastro atualizado.');
    } catch (error) { setMessage(error.message); }
  };

  const today = new Date();
  const todayAppointments = data.appointments.filter((appointment) => new Date(appointment.startsAt).toDateString() === today.toDateString());
  const revenue = data.appointments.filter((appointment) => appointment.status === 'CONCLUIDO').reduce((sum, item) => sum + item.priceCents, 0);
  const tabs = [
    ['Agenda', CalendarDays], ['Serviços', Scissors], ['Estilos', Scissors], ['Equipe', UsersRound], ['Editar', Pencil], ['Horários', Clock3], ['Bloqueios', CalendarDays], ['Clientes', UsersRound], ['Galeria', Images], ['Barbearia', Settings2], ['Assistente IA', Sparkles],
  ];
  const editItems = editKind === 'service' ? data.services : editKind === 'barber' ? data.barbers : data.styles;
  const editItem = editItems.find((item) => item.id === editId) || editItems[0];

  return <main className="admin-workspace">
    <header className="admin-workspace-header"><Link className="admin-workspace-brand" href="/"><Scissors size={18} /> Navalha Studio <span style={{ color: '#887d68', fontFamily: 'inherit', fontSize: 8 }}>ADMIN</span></Link><div className="admin-workspace-actions"><Link href="/"><ArrowLeft size={12} /> PAINEL PRINCIPAL</Link><button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/admin/login'; }}>SAIR</button></div></header>
    <div className="admin-workspace-heading"><div><span className="customer-eyebrow">GESTÃO DA BARBEARIA</span><h1>{data.tenant.name}</h1><p>Agendamentos, equipe e operação em um só lugar.</p></div><span>ACESSO ADMINISTRADOR</span></div>
    <div className="admin-stat-grid"><article className="admin-stat"><span>AGENDAMENTOS HOJE</span><strong>{todayAppointments.length}</strong></article><article className="admin-stat"><span>CLIENTES</span><strong>{data.customers.length}</strong></article><article className="admin-stat"><span>FATURAMENTO CONCLUÍDO</span><strong>{money(revenue)}</strong></article><article className="admin-stat"><span>EQUIPE ATIVA</span><strong>{data.barbers.filter((barber) => barber.active).length}</strong></article></div>
    <nav className="admin-nav">{tabs.map(([name, Icon]) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => { setTab(name); setMessage(''); }}><Icon size={12} /> {name}</button>)}</nav>
    {message && <div className="admin-message" role="status">{message}</div>}
    {tab === 'Agenda' && <section className="admin-panel"><div className="admin-panel-heading"><h2>Todos os agendamentos</h2><span>Todos os barbeiros · {data.appointments.length} registros</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>DATA E HORÁRIO</th><th>CLIENTE</th><th>PROFISSIONAL</th><th>SERVIÇO</th><th>VALOR</th><th>STATUS</th></tr></thead><tbody>{data.appointments.map((appointment) => <tr key={appointment.id}><td>{formatDate(appointment.startsAt, data.tenant.timezone)}</td><td><strong>{appointment.customer.user.name}</strong><br />{appointment.customer.user.phone || appointment.customer.user.email}</td><td>{appointment.barber.name}</td><td>{appointment.service.name}{appointment.hairStyle ? ` · ${appointment.hairStyle.name}` : ''}</td><td>{money(appointment.priceCents)}</td><td><select aria-label={`Status de ${appointment.customer.user.name}`} className="admin-status-select" value={appointment.status} onChange={(event) => updateAppointment(appointment, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table>{!data.appointments.length && <div className="admin-empty">Os agendamentos dos seus clientes aparecerão aqui.</div>}</div></section>}
    {tab === 'Serviços' && <section className="admin-panel"><div className="admin-panel-heading"><h2>Catálogo de serviços</h2><span>Preço e duração aparecem no agendamento do cliente.</span></div><form className="admin-form-grid" onSubmit={(event) => submitCatalog(event, 'service')}><label className="admin-form-field">Nome<input name="name" required minLength={2} /></label><label className="admin-form-field">Descrição<input name="description" maxLength={500} /></label><label className="admin-form-field">Preço em reais<input name="price" type="number" step="0.01" min="0" required /></label><label className="admin-form-field">Duração em minutos<input name="durationMinutes" type="number" min="5" max="480" required /></label><button className="admin-submit" disabled={busy}>ADICIONAR SERVIÇO</button></form><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>SERVIÇO</th><th>DESCRIÇÃO</th><th>PREÇO</th><th>DURAÇÃO</th><th>STATUS</th><th>AÇÃO</th></tr></thead><tbody>{data.services.map((service) => <tr key={service.id}><td><strong>{service.name}</strong></td><td>{service.description}</td><td>{money(service.priceCents)}</td><td>{service.durationMinutes} min</td><td>{service.active ? 'Ativo' : 'Inativo'}</td><td><button className={`admin-inline-button ${service.active ? 'danger' : ''}`} onClick={() => toggleCatalogItem('service', service)}>{service.active ? 'DESATIVAR' : 'ATIVAR'}</button></td></tr>)}</tbody></table></div></section>}
    {tab === 'Estilos' && <section className="admin-panel"><div className="admin-panel-heading"><h2>Estilos de corte</h2><span>Referências de estilo para os clientes escolherem.</span></div><form className="admin-form-grid" onSubmit={(event) => submitCatalog(event, 'style')}><label className="admin-form-field">Nome do estilo<input name="name" required minLength={2} /></label><label className="admin-form-field">Descrição<input name="description" maxLength={500} /></label><label className="admin-form-field">Serviço<select name="serviceId"><option value="">Qualquer serviço</option>{data.services.filter((service) => service.active).map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label><label className="admin-form-field">URL da imagem<input name="imageUrl" type="url" /></label><button className="admin-submit" disabled={busy}>ADICIONAR ESTILO</button></form><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ESTILO</th><th>DESCRIÇÃO</th><th>SERVIÇO</th><th>STATUS</th><th>AÇÃO</th></tr></thead><tbody>{data.styles.map((style) => <tr key={style.id}><td><strong>{style.name}</strong></td><td>{style.description}</td><td>{style.service?.name || 'Todos'}</td><td>{style.active ? 'Ativo' : 'Inativo'}</td><td><button className={`admin-inline-button ${style.active ? 'danger' : ''}`} onClick={() => toggleCatalogItem('style', style)}>{style.active ? 'DESATIVAR' : 'ATIVAR'}</button></td></tr>)}</tbody></table></div></section>}
    {tab === 'Equipe' && <section className="admin-panel"><div className="admin-panel-heading"><h2>Barbeiros</h2><span>Credenciais são opcionais; sem elas, o barbeiro não consegue entrar.</span></div><form className="admin-form-grid" onSubmit={(event) => submitCatalog(event, 'barber')}><label className="admin-form-field">Nome<input name="name" required minLength={2} /></label><label className="admin-form-field">Especialidades<input name="specialties" placeholder="Fade, barba, clássico" /></label><label className="admin-form-field">E-mail de acesso<input name="email" type="email" /></label><label className="admin-form-field">Senha inicial<input name="password" type="password" minLength={10} /></label><button className="admin-submit" disabled={busy}>CADASTRAR BARBEIRO</button></form><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>NOME</th><th>ESPECIALIDADES</th><th>ACESSO</th><th>AVALIAÇÃO</th><th>STATUS</th><th>AÇÃO</th></tr></thead><tbody>{data.barbers.map((barber) => <tr key={barber.id}><td><strong>{barber.name}</strong></td><td>{barber.specialties}</td><td>{barber.user?.email || 'Sem login'}</td><td>{barber.rating.toFixed(1)} · {barber.reviewCount} avaliações</td><td>{barber.active ? 'Ativo' : 'Inativo'}</td><td><button className={`admin-inline-button ${barber.active ? 'danger' : ''}`} onClick={() => toggleCatalogItem('barber', barber)}>{barber.active ? 'DESATIVAR' : 'ATIVAR'}</button></td></tr>)}</tbody></table></div></section>}
    {tab === 'Horários' && <section className="admin-panel"><div className="admin-panel-heading"><h2>Funcionamento e disponibilidade</h2><span>Horários dos barbeiros substituem os horários gerais para o dia selecionado.</span></div><form className="admin-form-grid" onSubmit={saveHours}><label className="admin-form-field">Agenda de<select name="scope" onChange={(event) => { const select = event.target.form.elements.barberId; select.disabled = event.target.value !== 'barber'; }}>{['Barbearia', 'Barbeiro'].map((label) => <option value={label === 'Barbearia' ? 'business' : 'barber'} key={label}>{label}</option>)}</select></label><label className="admin-form-field">Profissional<select name="barberId" disabled>{data.barbers.filter((item) => item.active).map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}</select></label><label className="admin-form-field">Dia<select name="dayOfWeek">{days.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label><label className="admin-form-field">Abre<input name="start" type="time" defaultValue="09:00" /></label><label className="admin-form-field">Fecha<input name="end" type="time" defaultValue="20:00" /></label><label className="admin-form-field admin-checkbox"><span>Atende neste dia</span><input name="isOpen" type="checkbox" defaultChecked /></label><button className="admin-submit">SALVAR HORÁRIO</button></form><div className="admin-hours-grid">{days.map((day, index) => { const hours = data.businessHours.filter((item) => item.dayOfWeek === index); const display = hours.map((item) => item.isOpen ? `${minuteTime(item.startMinute)}–${minuteTime(item.endMinute)}` : 'Fechado').join(' · ') || 'Sem expediente cadastrado'; return <div className="admin-hours-row" key={day}><strong>{day}</strong><span>{display}</span><small>{data.barberHours.filter((item) => item.dayOfWeek === index).length ? `${data.barberHours.filter((item) => item.dayOfWeek === index).length} barbeiros com agenda própria` : ''}</small></div>; })}</div></section>}
    {tab === 'Bloqueios' && <section className="admin-panel"><div className="admin-panel-heading"><h2>Feriados e horários bloqueados</h2><span>Bloqueio geral ou de um profissional.</span></div><form className="admin-form-grid" onSubmit={addBlock}><label className="admin-form-field">Abrangência<select name="barberId"><option value="">Toda a barbearia</option>{data.barbers.filter((item) => item.active).map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}</select></label><label className="admin-form-field">Data<input name="date" type="date" required /></label><label className="admin-form-field">Início<input name="start" type="time" required /></label><label className="admin-form-field">Fim<input name="end" type="time" required /></label><label className="admin-form-field">Motivo<input name="reason" maxLength={160} /></label><button className="admin-submit">BLOQUEAR HORÁRIO</button></form><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>DATA</th><th>PROFISSIONAL</th><th>MOTIVO</th><th></th></tr></thead><tbody>{data.blockedTimes.map((block) => <tr key={block.id}><td>{formatDate(block.startsAt, data.tenant.timezone)} – {new Intl.DateTimeFormat('pt-BR', { timeZone: data.tenant.timezone, hour: '2-digit', minute: '2-digit' }).format(block.endsAt)}</td><td>{block.barber?.name || 'Toda a barbearia'}</td><td>{block.reason}</td><td><button className="admin-inline-button danger" onClick={() => removeBlock(block.id)}>REMOVER</button></td></tr>)}</tbody></table></div></section>}
    {tab === 'Clientes' && <section className="admin-panel"><div className="admin-panel-heading"><h2>Clientes cadastrados</h2><input className="admin-search" placeholder="Buscar nome, e-mail ou telefone" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>CLIENTE</th><th>E-MAIL</th><th>TELEFONE</th><th>AGENDAMENTOS</th><th>CADASTRO</th></tr></thead><tbody>{data.customers.filter((customer) => `${customer.user.name} ${customer.user.email} ${customer.user.phone || ''}`.toLowerCase().includes(search.toLowerCase())).map((customer) => <tr key={customer.id}><td><strong>{customer.user.name}</strong></td><td>{customer.user.email}</td><td>{customer.user.phone || '—'}</td><td>{customer._count.appointments}</td><td>{formatDate(customer.user.createdAt, data.tenant.timezone)}</td></tr>)}</tbody></table></div></section>}
    {tab === 'Galeria' && <section className="admin-panel"><div className="admin-panel-heading"><h2>Galeria da barbearia</h2><span>Adicione fotos com URL pública.</span></div><form className="admin-form-grid" onSubmit={saveGallery}><label className="admin-form-field">Título<input name="title" required /></label><label className="admin-form-field">URL da imagem<input name="imageUrl" type="url" required /></label><button className="admin-submit">ADICIONAR FOTO</button></form><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>TÍTULO</th><th>ENDEREÇO</th><th></th></tr></thead><tbody>{data.gallery.map((item) => <tr key={item.id}><td>{item.title}</td><td><a href={item.imageUrl} target="_blank" rel="noreferrer">{item.imageUrl}</a></td><td><button className="admin-inline-button danger" onClick={async () => { await request(`/api/admin/gallery?id=${item.id}`, 'DELETE'); setData((current) => ({ ...current, gallery: current.gallery.filter((entry) => entry.id !== item.id) })); }}>REMOVER</button></td></tr>)}</tbody></table></div></section>}
    {tab === 'Barbearia' && <section className="admin-panel"><div className="admin-panel-heading"><h2>Informações e políticas</h2><span>Defina os dados exibidos e regras de cancelamento.</span></div><form className="admin-form-grid settings-grid" onSubmit={saveTenant}><label className="admin-form-field">Nome<input name="name" defaultValue={data.tenant.name} required /></label><label className="admin-form-field">Telefone<input name="phone" defaultValue={data.tenant.phone} /></label><label className="admin-form-field">E-mail<input name="email" type="email" defaultValue={data.tenant.email} /></label><label className="admin-form-field">Instagram<input name="instagram" defaultValue={data.tenant.instagram} /></label><label className="admin-form-field">Endereço<input name="address" defaultValue={data.tenant.address} /></label><label className="admin-form-field">Antecedência para cancelar (horas)<input name="cancelNoticeHours" type="number" min="0" max="168" defaultValue={data.tenant.cancelNoticeHours} required /></label><button className="admin-submit">SALVAR CONFIGURAÇÕES</button></form><div className="admin-message">Assistente IA: configure a chave OPENAI_API_KEY no servidor para ativar respostas reais. A disponibilidade da IA deve sempre usar estas ferramentas de backend.</div></section>}
    {tab === 'Assistente IA' && <section className="admin-panel admin-ai-settings"><div className="admin-panel-heading"><h2>Assistente IA</h2><span>Respostas sempre respeitam os serviços e a disponibilidade cadastrados.</span></div><form className="admin-form-grid" onSubmit={saveTenant}><label className="admin-field-checkbox"><input type="checkbox" name="aiEnabled" defaultChecked={data.tenant.aiEnabled} /><span><strong>Ativar assistente para clientes</strong><small>Atendimento por conversa e consultas de horário</small></span></label><label className="admin-form-field admin-ai-guidance">Orientações de atendimento<textarea name="aiInstructions" maxLength={2000} defaultValue={data.tenant.aiInstructions} placeholder="Ex.: use um tom cordial e destaque a política de cancelamento." /></label><button className="admin-submit">SALVAR CONFIGURAÇÃO</button><p className="admin-ai-note">A IA não cria horários, preços ou barbeiros. Toda reserva passa pelas regras do banco e precisa de confirmação explícita.</p></form></section>}
    {tab === 'Editar' && <section className="admin-panel"><div className="admin-panel-heading"><h2>Editar cadastros</h2><span>Alterações aparecem na próxima consulta de agendamento.</span></div><div className="admin-form-grid"><label className="admin-form-field">Tipo<select value={editKind} onChange={(event) => { setEditKind(event.target.value); setEditId(''); }}><option value="service">Serviço</option><option value="barber">Barbeiro</option><option value="style">Estilo de corte</option></select></label><label className="admin-form-field">Cadastro<select value={editItem?.id || ''} onChange={(event) => setEditId(event.target.value)}>{editItems.map((item) => <option value={item.id} key={item.id}>{item.name}{item.active ? '' : ' · Inativo'}</option>)}</select></label></div>{editItem && <form className="admin-form-grid admin-edit-form" key={`${editKind}-${editItem.id}`} onSubmit={saveCatalogEdit}><label className="admin-form-field">Nome<input name="name" defaultValue={editItem.name} required minLength={2} /></label>{editKind === 'service' && <><label className="admin-form-field">Descrição<input name="description" defaultValue={editItem.description} maxLength={500} /></label><label className="admin-form-field">Preço em reais<input name="price" type="number" step="0.01" min="0" defaultValue={(editItem.priceCents / 100).toFixed(2)} required /></label><label className="admin-form-field">Duração em minutos<input name="durationMinutes" type="number" min="5" max="480" defaultValue={editItem.durationMinutes} required /></label><label className="admin-form-field">URL de imagem<input name="imageUrl" type="url" defaultValue={editItem.imageUrl || ''} /></label></>}{editKind === 'barber' && <><label className="admin-form-field">Especialidades<input name="specialties" defaultValue={editItem.specialties} /></label><label className="admin-form-field">Apresentação<input name="bio" defaultValue={editItem.bio} /></label></>}{editKind === 'style' && <><label className="admin-form-field">Descrição<input name="description" defaultValue={editItem.description} /></label><label className="admin-form-field">Serviço<select name="serviceId" defaultValue={editItem.serviceId || ''}><option value="">Qualquer serviço</option>{data.services.filter((service) => service.active).map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label><label className="admin-form-field">URL de imagem<input name="imageUrl" type="url" defaultValue={editItem.imageUrl || ''} /></label></>}<button className="admin-submit">SALVAR ALTERAÇÕES</button></form>}</section>}
    <footer className="admin-workspace-footer"><Wallet size={12} /> Dados vinculados a {data.tenant.name} · acesso isolado por perfil e barbearia</footer>
  </main>;
}