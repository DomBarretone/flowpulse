#!/usr/bin/env bash
set -u

echo "=== FlowPulse - verificação do ambiente ==="
echo

check() {
  local label="$1"
  shift
  printf "%-22s" "$label:"
  if command -v "$1" >/dev/null 2>&1; then
    "$@" 2>&1 | head -n 1
  else
    echo "NÃO ENCONTRADO"
  fi
}

check "Node.js" node --version
check "npm" npm --version
check "Git" git --version
check "Docker" docker --version

printf "%-22s" "Docker Compose:"
if command -v docker >/dev/null 2>&1; then
  docker compose version 2>&1 | head -n 1
else
  echo "NÃO ENCONTRADO"
fi

check "OpenSpec" openspec --version

printf "%-22s" "Playwright:"
if command -v npx >/dev/null 2>&1; then
  npx --yes playwright --version 2>&1 | head -n 1
else
  echo "NÃO ENCONTRADO"
fi

check "OpenCode" opencode --version
check "OmniRoute" omniroute --version

echo
echo "Obs.: Antigravity e as contas web devem ser verificadas visualmente."
