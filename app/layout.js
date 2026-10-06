import './globals.css';
import './auth.css';

export const metadata = {
  title: 'Navalha Studio | Gestão para Barbearias',
  description: 'Painel de gestão de barbearia com agenda, equipe, clientes e assistente de IA.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
