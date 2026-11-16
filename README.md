# Finder

Rotas otimizadas e rastreamento em tempo real de instaladores, com painel 3D para a gestão.
Next.js 16 + MapLibre + three.js + Neon Postgres (Drizzle).

## Rodar localmente
1. `cp .env.example .env.local` e preencha `DATABASE_URL` e `JWT_SECRET`
   (`drizzle-kit`/seed leem `.env`; copie também para `.env` ou exporte as variáveis).
2. `npm run db:push` (cria as tabelas) e `npm run db:seed` (dados de exemplo).
3. `npm run dev`. Logins de exemplo (senha `finder123`): `gestor@finder.dev`, `marcos@finder.dev`, `paula@finder.dev`.

## Deploy na Vercel (grátis)
- Vercel > Storage > Create > Neon (plano Free). `DATABASE_URL` é injetada no projeto.
- Adicione `JWT_SECRET` em Environment Variables.
- Rode `db:push` e `db:seed` localmente com a `DATABASE_URL` do Neon.

## Fluxo
- Instalador (`/installer`): inicia o turno, o GPS é enviado a cada 5s (fila offline em IndexedDB) e atualiza o status dos serviços.
- Gestor (`/manager`): mapa 3D ao vivo (polling 4s), clique em instaladores e clientes, "Atribuir e otimizar rotas" usa OSRM + vizinho mais próximo/2-opt.
- `POST /api/manager/jobs` cria cliente + serviço do dia.
