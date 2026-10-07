import './globals.css';
import './auth.css';

export const metadata = {
  title: 'Navalha Tech Barber | SaaS Next-Gen & Agendamento Inteligente',
  description: 'Plataforma inteligente para barbearias de alta performance com IA neural, agendamento online público e controle operacional em tempo real.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
