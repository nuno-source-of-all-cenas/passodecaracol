# Build log

| screen | date | status | missing | harder than expected |
| --- | --- | --- | --- | --- |
| shell + tokens | 2026-10-18 | done | — | sem npm/CDN no sandbox: app sem dependências (JS + SVG) |
| S01 feed | 2026-10-18 | done | paginação real (cursor) | — |
| S02 gravar | 2026-10-18 | partial | GPS em segundo plano (precisa de app nativa) | simulador com semáforos para testar a pausa automática |
| S03 guardar | 2026-10-18 | done | — | — |
| S04 detalhe | 2026-10-18 | done | flyby | sincronizar cursor entre gráficos e mapa |
| S05 editar | 2026-10-18 | done | — | — |
| S06/S07 segmentos | 2026-10-18 | done | — | correspondência: bug de cache que misturava segmentos, corrigido |
| S08/S09 rotas | 2026-10-18 | done | encaminhamento em ruas reais (OSRM/GraphHopper) | — |
| S10/S11 perfil | 2026-10-18 | done | resumo anual | — |
| S12-S14 treino | 2026-10-18 | done | planos de treino | — |
| S15-S17 grupos | 2026-10-18 | done | — | — |
| S18 equipamento | 2026-10-18 | done | — | — |
| S19-S21 | 2026-10-18 | done | push reais | — |
| S22 upload | 2026-10-18 | done | ficheiros FIT | — |

Testes: `app/` passa um percurso automático em Chromium (desktop 1366 e telemóvel 390): todos os ecrãs, gravar → guardar, kudos, comentário, rota, GPX, entrada manual, km/milhas, tema escuro. Zero erros de consola, sem scroll horizontal.

## Backend (2026-10-18)

- Supabase: projeto «Nuno's Playground», schema `passo` (migração `passo_init`): 26 tabelas com RLS, funções `push_live`, `end_live`, `get_live`, `get_live_many`.
- Testado por SQL numa transação desfeita: o dono escreve a partilha; outro utilizador não vê atividades privadas nem toma conta da partilha; um visitante anónimo lê só a partilha cujo id conhece; o anónimo não lê tabelas.
- App: `app/src/cloud.js` (login, envio da posição ao vivo a cada 3 s, página pública `?s=<id>`, cópia de atividades e sessões). Desligado quando não há rede (pré-visualização do Claude).
- Por fazer antes de abrir registos: expor o schema `passo` na Data API; impedir que o trigger `handle_new_user` da app de reservas dê acesso a utilizadores do Passo.
