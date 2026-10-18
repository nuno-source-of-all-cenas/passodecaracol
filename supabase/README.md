# Supabase

Projeto: «Nuno's Playground» (`zwiemchpxxldfsubfybm`, eu-west-1), schema `passo`.
O projeto é partilhado com a app de reservas; o Passo não toca no schema `public`.

Migrações aplicadas (por esta ordem):

| versão | nome | o quê |
| --- | --- | --- |
| 20261018190816 | passo_init | 26 tabelas, RLS, `push_live`, `end_live`, `get_live`, `get_live_many` |

Para recriar noutro projeto: `supabase db dump --schema passo` no projeto atual, ou
aplicar `migrations/20261018190816_passo_init.sql`.

Antes de abrir registos:
1. **Expor o schema `passo`** em Project Settings → Data API → Exposed schemas.
2. **Trigger `handle_new_user`** (da app de reservas) em `auth.users`: hoje dá a cada utilizador
   novo o papel `owner` do tenant `tasca-do-alvim`. As contas do Passo são criadas com
   `raw_user_meta_data.app = 'passo'`; o trigger tem de as ignorar.
