# Architecture: Passo (a rebuild of Strava's core features)

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Next.js (App Router) + TypeScript, PWA | uma base para web e instalável no telemóvel |
| mobile (fase 2) | Expo (React Native) + expo-location em background | gravação GPS com ecrã desligado só funciona bem nativo |
| maps | MapLibre GL + tiles OpenStreetMap (MapTiler ou Protomaps) | aberto, sem trade dress |
| database | Postgres no Supabase + PostGIS | geometrias, índices espaciais para segmentos |
| auth | Supabase Auth (email, Google, Apple) | RLS no mesmo sítio |
| payments | Stripe Checkout + Billing | plano Pro mensal/anual |
| files | Supabase Storage | fotos e ficheiros GPX/FIT |
| jobs | Supabase Edge Functions + pg_cron | análise da atividade, segmentos, notificações |
| push | Expo Push / Web Push | kudos e comentários |
| hosting | Vercel | já ligado nesta conta |

Protótipo atual (`app/`): SPA sem dependências, camada de dados falsa em `store.js` com as mesmas operações que a API vai ter, para trocar por Supabase sem mexer nos ecrãs.

## Schema

Tables: 20. Access rules: RLS no Supabase. Ver `schema.sql`.

## API

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| POST /api/activities | cria atividade (stream) e enfileira análise | o próprio | sport, stream, meta | activity | F01, F07 |
| PATCH /api/activities/:id | edita | dono | campos | activity | — |
| DELETE /api/activities/:id | apaga | dono | — | 204 | — |
| GET /api/feed?cursor | feed de seguidos | autenticado | cursor | activities[] | F02 |
| POST /api/activities/:id/kudos | dá/retira kudos | quem vê a atividade | — | count | F02 |
| POST /api/activities/:id/comments | comenta | quem vê | text | comment | F02 |
| GET /api/segments?bbox&sport | explora | todos | bbox | segments[] | F03 |
| GET /api/segments/:id/leaderboard?filter | classificação | autenticado (filtros: Pro) | filter | efforts[] | F03 |
| POST /api/segments | cria a partir de atividade | autenticado | activity_id, from, to | segment | F03 |
| POST /api/routes | guarda rota | autenticado | polyline | route | F04 |
| POST /api/challenges/:id/join | adere | autenticado | — | join | F05 |
| POST /api/clubs/:id/join | entra | autenticado | — | member | F06 |
| POST /api/uploads | GPX/FIT | autenticado | file | activity | F07 |
| POST /api/stripe/webhook | estado da subscrição | Stripe | evento | 200 | — |

Jobs: `analyze_activity` (on insert: stats, parciais, melhores esforços, segment matching, PRs/KOMs, desafios), `notify` (kudos/comentários), `local_legend` (diário), `weekly_club_leaderboard` (segunda 00:00 local).

## The parts that bite

- time zones: guardar `start_at` em UTC + `timezone` da atividade; semanas e desafios contam no fuso do atleta.
- idempotency: uploads com hash do ficheiro; webhooks Stripe pelo event id.
- races: dois uploads iguais vindos de relógio e telemóvel → deteção de duplicados por início ±60 s.
- segment matching em escala: PostGIS `ST_DWithin` no início/fim + verificação de ordem e comprimento; só segmentos no bbox da atividade.
- privacy zones: aplicar no servidor antes de devolver o stream a terceiros, nunca só no cliente.
- GPS em segundo plano: só nativo (Expo) — a PWA perde pontos com o ecrã desligado.
- GDPR: exportar e apagar todos os dados do atleta.

## Build order

1. Vertical slice: gravar → guardar → detalhe → feed (S01–S04). **feito no protótipo**
2. Must-haves: social, segmentos, rotas, perfil, clubes, desafios. **feito no protótipo**
3. Backend: Supabase (schema.sql), auth, storage, edge function de análise, Stripe.
4. Mapas reais (MapLibre + OSM), PWA, depois Expo.
5. As correções do /replica-entrepreneur e a personalização (nicho).

## Funcionalidades próprias (v2, pedidas pelo Nuno)

| funcionalidade | protótipo | produção |
| --- | --- | --- |
| Sessão (nível 1) com atividades (nível 2) | gravador por sessão; atividades guardadas dentro dela; sessão retomável | tabelas `sessions` e `activities.session_id`; o relógio grava a sessão e marca o início/fim das atividades |
| Partilha ao vivo antes de começar | presence em tempo real da app publicada (4 KB por atleta, a cada 2 s) | Supabase Realtime (canal por `share_id`), página pública `/ao-vivo/:share_id` sem login, link com expiração |
| WhatsApp | link `wa.me` com o URL | idem, com pré-visualização Open Graph do mapa |
| Música | demo | Spotify Web API `currently-playing` com OAuth do atleta; Android: MediaSession; iOS: só Apple Music via MusicKit |
| Clipe de 3 s a cada 500 m | câmara do navegador quando permitida, senão imagem gerada | app nativa com câmara traseira (Android permite em serviço em primeiro plano; iOS não grava com o ecrã bloqueado: avisar), upload para Storage, URL assinado no canal |
| Fotos oficiais e certificados | ficheiros no próprio browser | Supabase Storage, `activity_files (kind: photo|certificate)` |
| Exportar CSV | resumo, parciais, pontos GPS, todas as atividades | idem + ZIP com fotos e certificados |
| Sapatilhas | ficha completa, custo por km, vida útil | colunas extra em `gear` |
| Passos (Samsung Health) | demo e importação CSV | Android: Health Connect (o Samsung Health sincroniza para lá); iOS: HealthKit |
| Seguir vários atletas numa prova | simulação + atletas reais que estejam a partilhar | canal por prova; lista de `share_id` subscritos |

Riscos: bateria (GPS + câmara + rede), dados móveis dos vídeos (comprimir, só Wi-Fi opcional), privacidade (a partilha mostra a posição exata: expiração automática e zona de privacidade no início).
