# Navalha Studio

SaaS starter para barbearias com áreas separadas para administração, barbeiros e clientes. Usa SQLite no desenvolvimento, Prisma para persistência, sessões assinadas em cookie HTTP-only e reservas em intervalos de 15 minutos.

## Começar

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Abra http://localhost:3000. As contas locais do seed usam a senha `Navalha123!`:

- Administrador: `admin@navalha.test` em `/admin/login`
- Barbeiro: `lucas@navalha.test` em `/barbeiro/login`
- Cliente: `cliente@navalha.test` em `/cliente/login`

Troque as credenciais seed e o segredo de sessão antes de publicar.

## Configuração

As variáveis locais ficam em `.env` (ignorado pelo Git). `.env.example` contém os nomes das variáveis. `DATABASE_URL` usa SQLite; para produção, migre para PostgreSQL e aplique as migrações. `SESSION_SECRET` deve ter pelo menos 32 caracteres aleatórios.

Para ativar interpretação de linguagem natural, configure `OPENAI_API_KEY`; `OPENAI_MODEL` é opcional e usa `gpt-4o-mini` por padrão. O copiloto consulta os mesmos serviços e horários do fluxo manual. Não cria agendamento antes da confirmação explícita. Sem chave, usa regras locais e pergunta quando não reconhece os dados com segurança.

Para enviar recuperação de senha por e-mail, configure `RESEND_API_KEY`, `EMAIL_FROM` e `NEXT_PUBLIC_APP_URL`. Sem e-mail configurado, a resposta continua genérica para não revelar se uma conta existe, mas o link não será enviado.

## Áreas

- `/` preserva o dashboard visual existente.
- `/admin/gestao` gerencia agendamentos de todos os barbeiros, serviços, estilos, equipe, horários, bloqueios, clientes, galeria, dados da barbearia e comportamento do assistente.
- `/barbeiro` mostra apenas a agenda do profissional autenticado e permite atualizar atendimentos e bloquear horários próprios.
- `/cliente/login`, `/cliente/cadastro`, `/cliente/esqueci-senha`, `/cliente/redefinir-senha`, `/cliente/minha-conta`, `/cliente/meus-agendamentos` e `/cliente/novo-agendamento` formam a área mobile-first do cliente.

Os registros carregam `tenantId`; consultas de cada perfil são filtradas pela barbearia da sessão. Reservas são persistidas no banco e protegidas por restrição única para evitar horários duplicados concorrentes.

## Antes de produção

- O seed, as credenciais de demonstração, o segredo local e SQLite são apenas para desenvolvimento; configure credenciais próprias, PostgreSQL gerenciado, backups, rate limiting, monitoramento e segredos de produção.
- O cadastro público associa o cliente a `navalha-studio`; produção deve resolver tenants por domínio ou link de agendamento.
- Configure pagamentos, WhatsApp, política de privacidade e termos reais antes de atender clientes.
- A IA não recebe acesso direto ao banco. Disponibilidade, tenant, confirmação e ações são sempre validados no backend.

## Banco

`npm run db:migrate` sincroniza o schema Prisma local com SQLite (`db push`). `npm run db:seed` pode ser executado novamente sem duplicar os dados de demonstração. `npm run db:studio` abre o Prisma Studio.

No Vercel, conecte o projeto a um repositório GitHub privado e adicione o Neon pela integração de Storage. Depois de baixar as variáveis com `vercel env pull .env.local`, sincronize o schema PostgreSQL com `npm run db:push:postgres`. Preencha os valores `BOOTSTRAP_*` em `.env.local` com os dados da sua barbearia e execute `npm run db:bootstrap` uma única vez para criar o primeiro administrador. Esses valores ficam locais e não devem ser commitados.

## Vercel + Neon

O repositório contém `vercel.json` e um schema PostgreSQL dedicado. Importe um repositório GitHub privado na Vercel, conecte Neon e configure `DATABASE_URL` (pooling), `DIRECT_URL` (conexão direta), `SESSION_SECRET` aleatório e `NEXT_PUBLIC_APP_URL`. A Vercel gera o Prisma Client PostgreSQL durante o build. Antes de abrir o site, sincronize `prisma/schema.postgres.prisma` com o Neon e execute `npm run db:bootstrap` uma única vez com `BOOTSTRAP_TENANT_NAME`, `BOOTSTRAP_TENANT_SLUG`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` e uma senha exclusiva de pelo menos 12 caracteres. Não execute o seed local em produção: ele cria contas de demonstração conhecidas.

`db:push:postgres` aplica o schema inicial no Neon; para mudanças futuras em produção, prefira migrações SQL versionadas e revisadas antes do deploy.