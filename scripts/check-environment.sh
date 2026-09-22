#!/usr/bin/env bash
set -e

echo "=== FlowPulse - Validação de Ambiente ==="
echo

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env if present
if [ -f "$ROOT_DIR/.env" ]; then
  # Export variables from .env ignoring comments and empty lines
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
  echo "✔ Arquivo .env carregado com sucesso."
else
  echo "⚠ Arquivo .env não encontrado na raiz. Verificando variáveis do ambiente atual."
fi

REQUIRED_VARS=(
  "DATABASE_URL"
  "GLOBAL_PREFIX"
  "NEXT_PUBLIC_API_URL"
)

MISSING_VARS=()

for var_name in "${REQUIRED_VARS[@]}"; do
  val="${!var_name:-}"
  if [ -z "$val" ]; then
    MISSING_VARS+=("$var_name")
  else
    echo "✔ Variável $var_name definida."
  fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
  echo
  echo "❌ ERRO: As seguintes variáveis de ambiente obrigatórias estão ausentes ou vazias:"
  for var_name in "${MISSING_VARS[@]}"; do
    echo "   - $var_name"
  done
  echo
  echo "Configure-as no seu arquivo .env ou no ambiente antes de prosseguir."
  exit 1
fi

echo
echo "✔ Todas as variáveis obrigatórias estão presentes."

# Test database connectivity if Prisma Client is available
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Testando conectividade com o banco de dados ($DATABASE_URL)..."
  if node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.\$connect()
      .then(() => { console.log('✔ Conexão com o banco de dados estabelecida com sucesso.'); process.exit(0); })
      .catch((err) => { console.warn('⚠ Não foi possível conectar ao banco no momento:', err.message); process.exit(0); });
  " 2>/dev/null; then
    :
  else
    echo "⚠ Teste de conectividade ignorado (Prisma Client não gerado ou dependência não instalada)."
  fi
fi

echo
echo "=== Validação do ambiente concluída com sucesso! ==="
exit 0
