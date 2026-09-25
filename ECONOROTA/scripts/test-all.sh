#!/usr/bin/env bash
# Roda todas as verificações do EconoRota. A parte de integração exige a API local rodando
# (cd api && npm run dev) com DEV_MODE=true; sem ela, é pulada com aviso.
set -euo pipefail
cd "$(dirname "$0")/.."
API="${API:-http://localhost:8787}"

echo "== API: tipos e testes unitários"
(cd api && npx tsc --noEmit && npm test --silent)

if curl -sf "$API/health" >/dev/null; then
  echo "== API: integração (smoke) em $API"
  (cd api && API="$API" bash scripts/smoke.sh)
  echo "== API: carga rápida"
  (cd api && API="$API" node scripts/load.mjs 10 10)
else
  echo "!! API local não encontrada em $API — integração e carga puladas (rode: cd api && npm run dev)"
fi

echo "== App: análise e testes (unitários + telas)"
(cd app && flutter analyze && flutter test)
echo "Tudo certo."
