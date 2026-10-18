# Passo

Rebuild das funcionalidades do Strava (clean-room), feito com o pack Replica.
Nome provisório: o `/replica-brand` decide o nome final antes do lançamento.

```
replica/recon.md        recon: 22 ecrãs, 8 fluxos, 21 entidades, fontes
replica/features.csv    matriz de funcionalidades (python3 ../replica-diff/parity.py replica/features.csv)
replica/architecture.md stack, API, partes difíceis, ordem de build
replica/schema.sql      primeira migração Postgres + PostGIS + RLS (Supabase)
replica/build-log.md    estado por ecrã
app/src/                a app (JS sem dependências; live.js = sessões ao vivo, provas, sapatilhas, passos)
app/build.sh            gera app/dist/index.html (artifact) e app/dist/local.html (abrir no browser)
```

A camada de dados (`app/src/store.js`) guarda tudo no browser e tem as mesmas
operações da API planeada, para trocar por Supabase sem mexer nos ecrãs.
Atletas, clubes e atividades de exemplo são fictícios; a cidade de
demonstração é gerada (terreno, rio, parques e ruas), sem mapas de terceiros.
