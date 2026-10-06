'use client';

import { useState } from 'react';
import { MessageCircle, Send, Sparkles, X } from 'lucide-react';

export default function CustomerAI() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Olá! Posso consultar os serviços e horários disponíveis para você. O que gostaria de agendar?' }]);

  const send = async (suggestion) => {
    const text = (suggestion ?? input).trim();
    if (!text || loading) return;
    setInput('');
    setError('');
    setMessages((current) => [...current, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const response = await fetch('/api/customer/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, ...(conversationId ? { conversationId } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não consegui consultar sua agenda.');
      setConversationId(result.conversationId);
      setMessages((current) => [...current, { role: 'assistant', content: result.reply }]);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setLoading(false);
    }
  };

  return <div className="customer-ai-widget">
    {open && <section className="customer-ai-panel" role="dialog" aria-modal="false" aria-label="Assistente de agendamento">
      <header className="customer-ai-header"><span className="customer-ai-mark"><Sparkles size={16} /></span><span><strong>Assistente Navalha</strong><small>Agenda verificada em tempo real</small></span><button aria-label="Fechar assistente" onClick={() => setOpen(false)}><X size={17} /></button></header>
      <div className="customer-ai-context"><Sparkles size={12} /> Serviços, valores e horários são consultados na agenda da barbearia.</div>
      <div className="customer-ai-messages">{messages.map((message, index) => <div key={`${index}-${message.role}`} className={`customer-ai-message ${message.role}`}>{message.content}</div>)}{loading && <div className="customer-ai-message assistant">Consultando os horários...</div>}</div>
      <div className="customer-ai-suggestions"><button disabled={loading} onClick={() => send('Quais serviços estão disponíveis?')}>Ver serviços</button><button disabled={loading} onClick={() => send('Quero marcar um horário')}>Encontrar horário</button></div>
      {error && <div className="customer-ai-error" role="alert">{error}</div>}
      <form className="customer-ai-composer" onSubmit={(event) => { event.preventDefault(); send(); }}><input aria-label="Mensagem para a assistente" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ex.: corte sábado à tarde" /><button aria-label="Enviar mensagem" disabled={loading}><Send size={15} /></button></form>
      <small className="customer-ai-disclaimer">Nenhum horário é reservado sem sua confirmação.</small>
    </section>}
    <button className="customer-ai-launcher" aria-label={open ? 'Fechar assistente' : 'Abrir assistente'} onClick={() => setOpen((current) => !current)}>{open ? <X size={20} /> : <><MessageCircle size={19} /><Sparkles size={12} /></>}</button>
  </div>;
}