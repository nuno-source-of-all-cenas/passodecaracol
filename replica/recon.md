# Recon map: Strava (web + iOS/Android)

Scope: o produto inteiro ao nível de funcionalidades — gravar, analisar, segmentos, rotas, social, treino, clubes, desafios. Sem a rede de utilizadores nem dados de terceiros.
For: app própria do Nuno (dig-in), para depois personalizar num nicho.
Date: 2026-10-18
Nome de trabalho do clone: **Passo** (provisório; o /replica-brand decide o nome final).

> Nota de método: este recon foi feito a partir de conhecimento público do produto (centro de ajuda, página de preços, fichas nas lojas), sem login, sem código do original e sem chamadas à API privada. Antes de investir a sério, confirmar cada linha contra as fontes abaixo com a tua própria conta. Os termos do Strava proíbem usar o serviço para construir um concorrente, por isso usa só fontes públicas.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | help center | https://support.strava.com | lista de funcionalidades mais completa |
| 2 | pricing | https://www.strava.com/subscribe | o que está atrás do paywall |
| 3 | public API docs | https://developers.strava.com/docs/reference/ | modelo de dados (Activity, Segment, SegmentEffort, Route, Club, Gear) |
| 4 | App Store | https://apps.apple.com/app/strava/id426826309 | screenshots dos ecrãs-chave |
| 5 | Google Play | https://play.google.com/store/apps/details?id=com.strava | idem + reviews (para o /replica-entrepreneur) |
| 6 | changelog / blog | https://stories.strava.com | o que tem sido priorizado |

## Core loop

Gravar uma atividade → vê-la analisada (mapa, parciais, segmentos, recordes) → receber kudos e comparar-se com os outros.

## Screens

| ID | screen | route | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Feed | `/` | atividades de quem segues | ActivityCard, ProfileSummary, ChallengeCard | empty (não segue ninguém), filled |
| S02 | Gravar | `/record` | gravar com GPS | SportPicker, LiveStats, MapLive, BigButton | idle, a gravar, pausado, sem GPS |
| S03 | Guardar atividade | `/record/save` | título, descrição, privacidade, equipamento, fotos | Form, PhotoPicker, Select | filled, error |
| S04 | Detalhe da atividade | `/activities/:id` | análise completa | Map, StatGrid, SplitsTable, ElevationChart, PaceChart, SegmentEffortList, Kudos, Comments | own, other, privada, sem GPS |
| S05 | Editar atividade | `/activities/:id/edit` | editar campos | Form | — |
| S06 | Explorar segmentos | `/segments` | lista + mapa | SegmentRow, Map, Filters | empty, filled |
| S07 | Detalhe do segmento | `/segments/:id` | classificação | Leaderboard, Tabs, Map, Profile | sem esforços, com coroa |
| S08 | Rotas | `/routes` | rotas guardadas | RouteCard | empty, filled |
| S09 | Construtor de rotas | `/routes/new` | desenhar rota | MapEditor, Toolbar, ElevationChart | vazio, a desenhar |
| S10 | Perfil | `/athletes/:id` | totais, atividades, troféus | StatTabs, WeeklyBars, TrophyCase | próprio, outro |
| S11 | Seguidores/a seguir | `/athletes/:id/follows` | listas | AthleteRow | empty |
| S12 | Diário de treino | `/training` | calendário | CalendarMonth | mês vazio |
| S13 | Forma e frescura | `/training/fitness` | carga ao longo do tempo | LineChart | pouca história, bloqueado (free) |
| S14 | Objetivos | `/training/goals` | metas | ProgressRing | empty |
| S15 | Clubes | `/clubs` | os meus + sugeridos | ClubCard | empty |
| S16 | Detalhe do clube | `/clubs/:id` | feed, classificação, eventos | Tabs, Leaderboard, EventCard, PostComposer | não membro |
| S17 | Desafios | `/challenges` | aderir | ChallengeCard, ProgressBar | aderido, completo |
| S18 | Equipamento | `/gear` | sapatilhas e bicicletas | GearRow | empty, alerta |
| S19 | Notificações | `/notifications` | atividade social | NotificationRow | empty |
| S20 | Pesquisa | `/search` | atletas | SearchInput, AthleteRow | sem resultados |
| S21 | Definições | `/settings` | unidades, privacidade, plano | Toggle, Select | — |
| S22 | Upload / manual | `/upload` | GPX ou entrada manual | FileDrop, Form | ficheiro inválido |

## Flows

```
F01 Gravar uma corrida
    S02 escolher desporto -> iniciar -> pausar/retomar -> terminar -> S03 guardar -> S04
    happy path clicks: 4
    edge: sem sinal GPS, app em segundo plano, pausa longa, bateria, descartar

F02 Dar kudos e comentar
    S01 -> kudos (1 clique) | S04 -> comentar
    edge: atividade privada, a própria atividade (não dá kudos a si próprio)

F03 Ver segmento e classificação
    S04 lista de esforços -> S07 -> filtro
    edge: primeiro esforço, empate, coroa perdida

F04 Desenhar uma rota e gravá-la
    S09 cliques no mapa -> guardar -> S08 -> "gravar esta rota" -> S02
    edge: um só ponto, rota enorme

F05 Aderir a um desafio e completá-lo
    S17 -> aderir -> (atividades) -> medalha em S10

F06 Entrar num clube e ver a classificação semanal
    S15 -> S16 -> entrar -> tab classificação

F07 Importar GPX / entrada manual
    S22 -> ficheiro -> S03 -> S04

F08 Definir objetivo e acompanhar
    S14 -> criar -> progresso no S01/S10
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, hover, focus, disabled | all |
| ActivityCard | own, other | com mapa, sem mapa, privada | S01, S10, S16 |
| Map | static, live, editor, heatmap | loading, sem pontos | S01, S02, S04, S06, S07, S09, S10 |
| StatGrid | 3 cols, 6 cols | — | S02, S04 |
| Charts | elevação, ritmo, barras, linhas | sem dados | S04, S07, S10, S13 |
| Leaderboard | segmento, clube | o meu lugar destacado | S07, S16 |
| Tabs | — | — | S06, S07, S10, S16 |
| Avatar | xs, sm, md, lg | — | all |
| ProgressBar / Ring | — | 0, parcial, completo | S14, S17 |

## Inferred data model

```
Athlete     id, name, sex, city, avatar, premium, created_at
            evidence: perfil, API /athletes   confidence: high
Follow      follower_id, followee_id, status (pending|accepted)
            evidence: S11, perfis privados     confidence: high
Activity    id, athlete_id, sport_type, name, description, start_at, timezone,
            distance_m, moving_time_s, elapsed_time_s, elevation_gain_m,
            avg_hr, max_hr, calories, perceived_exertion, visibility,
            gear_id, polyline, stream (lat,lon,ele,t,hr), hide_stats (json)
            evidence: S04, API Activity          confidence: high
Lap         activity_id, index, start_index, end_index, distance, time
Photo       activity_id, url, caption
Kudos       activity_id, athlete_id
Comment     activity_id, athlete_id, text
Segment     id, name, sport, polyline, distance_m, avg_grade, max_grade,
            elev_low, elev_high, climb_category, creator_id
            evidence: S07, API Segment            confidence: high
SegmentEffort  segment_id, activity_id, athlete_id, start_index, end_index,
            elapsed_time_s, start_at, pr_rank, kom_rank
StarredSegment athlete_id, segment_id
Route       id, athlete_id, name, sport, polyline, distance_m, elevation_gain_m
Gear        id, athlete_id, kind (shoe|bike), name, brand, distance_m, retired, alert_at_m
Club        id, name, sport, city, description, private
ClubMember  club_id, athlete_id, role (member|admin)
ClubPost    club_id, athlete_id, text
ClubEvent   club_id, title, start_at, route_id, rsvp[]
Challenge   id, name, metric (distance|time|elevation|effort), sport, target, starts_at, ends_at
ChallengeJoin challenge_id, athlete_id, completed_at
Goal        athlete_id, period (week|month|year), sport, metric, target
Notification athlete_id, kind, actor_id, ref_id, read_at
PrivacyZone athlete_id, lat, lon, radius_m
```

Relationships: Athlete 1-n Activity, Activity 1-n SegmentEffort n-1 Segment, Athlete n-n Club, Athlete n-n Challenge, Athlete 1-n Gear, Activity n-1 Gear.

## Feature matrix

See `features.csv`. Must: 27, should: 26, could: 16, skip: 4.

## Out of scope (cannot or should not be cloned)

- A rede de atletas e as classificações reais deles (os dados pertencem ao Strava e aos atletas).
- O heatmap global (derivado dos dados de todos os utilizadores).
- Os mapas base proprietários (usar OpenStreetMap / MapLibre).
- Parcerias de marcas nos desafios.
- Integrações de dispositivos via API privada — só APIs oficiais (Garmin Health API, Apple HealthKit, Google Health Connect) com chaves próprias.

## Size

Screens 22, flows 8, entities 21. Hard parts: gravação GPS fiável em segundo plano (precisa de app nativa), correspondência de segmentos em escala, integrações com relógios. Size: **XL** para o produto completo → recortado para **L**: web responsiva + PWA com todas as funcionalidades acima, backend Supabase, app nativa como fase seguinte.
