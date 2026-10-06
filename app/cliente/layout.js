import Link from 'next/link';
import { CalendarDays, Scissors } from 'lucide-react';
import './customer.css';
import './customer-ai.css';
import CustomerAI from '@/components/customer-ai';

export default function CustomerLayout({ children }) {
  return (
    <div className="customer-app">
      <header className="customer-header">
        <Link className="customer-logo" href="/cliente/login"><span><Scissors size={19} /></span><strong>NAVALHA</strong></Link>
        <nav><Link href="/cliente/novo-agendamento"><CalendarDays size={15} /> Agendar</Link><Link href="/cliente/minha-conta">Minha conta</Link></nav>
      </header>
      {children}
      <CustomerAI />
      <footer className="customer-footer">NAVALHA STUDIO <span>·</span> CUIDADO EM CADA DETALHE</footer>
    </div>
  );
}