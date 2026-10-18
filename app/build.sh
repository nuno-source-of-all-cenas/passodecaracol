#!/bin/sh
# Bundles src/ into one self-contained page: dist/index.html (published as the
# artifact, no doctype: the host wraps it) and dist/local.html (open locally).
set -e
cd "$(dirname "$0")"
mkdir -p dist
{
  echo '<title>Passo</title>'
  echo '<meta name="claude:viewport-fit-sides" content="cover">'
  echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700;800&display=swap">'
  echo '<style>'; cat src/styles.css; echo '</style>'
  echo '<div id="app"></div><div id="toasts" class="toasts" aria-live="polite"></div>'
  echo '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>'
  echo '<script>'
  for f in core seed analysis store charts live cloud views main; do cat "src/$f.js"; echo; done
  echo '</script>'
} > dist/index.html
{
  echo '<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'
  cat dist/index.html
  echo '</body></html>'
} > dist/local.html
wc -c dist/index.html
