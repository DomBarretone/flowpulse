#!/usr/bin/env bash
set -euo pipefail

# smoke-test.sh
# Verifies health and security endpoints of a deployed FlowPulse environment over HTTPS:
# 1. GET https://${DOMAIN}/ -> 200 (Web Frontend Next.js)
# 2. GET https://${DOMAIN}/api/v1/health -> 200 (API Backend NestJS)
# 3. GET https://${DOMAIN}/api/v1/automations -> 401 (Enforced Auth Guard)

TARGET="${1:-${FLOWPULSE_DOMAIN:-}}"
MAX_RETRIES="${MAX_RETRIES:-12}"
RETRY_DELAY="${RETRY_DELAY:-10}"

if [ -z "$TARGET" ]; then
  echo "Error: Target domain or URL must be provided as argument or FLOWPULSE_DOMAIN."
  echo "Usage: $0 <domain-or-base-url>"
  exit 1
fi

# Clean protocol prefix if passed
TARGET_URL="${TARGET#https://}"
TARGET_URL="${TARGET_URL#http://}"
BASE_URL="https://${TARGET_URL}"

echo "=================================================="
echo "FlowPulse HTTPS Post-Deployment Smoke Tests"
echo "Target Base URL: ${BASE_URL}"
echo "Max Retries: ${MAX_RETRIES} (Interval: ${RETRY_DELAY}s)"
echo "=================================================="

wait_for_endpoint() {
  local url="$1"
  local expected_status="$2"
  local description="$3"
  local attempt=1

  echo "--> Checking ${description}: ${url}"

  while [ $attempt -le $MAX_RETRIES ]; do
    status_code=$(curl -s -k -o /tmp/smoke_response.txt -w "%{http_code}" "$url" || echo "000")

    if [ "$status_code" = "$expected_status" ]; then
      echo "  [PASS] Attempt $attempt: Received expected HTTP $expected_status"
      return 0
    else
      echo "  [WAIT] Attempt $attempt/$MAX_RETRIES: Received HTTP $status_code (expected $expected_status). Retrying in ${RETRY_DELAY}s..."
      sleep "$RETRY_DELAY"
      attempt=$((attempt + 1))
    fi
  done

  echo "::error::[FAIL] Timeout waiting for ${description} (${url}). Expected HTTP $expected_status, last received HTTP $status_code."
  if [ -f /tmp/smoke_response.txt ]; then
    echo "Last response body (truncated):"
    head -c 500 /tmp/smoke_response.txt || true
    echo ""
  fi
  return 1
}

# 1. Frontend Liveness
wait_for_endpoint "${BASE_URL}/" "200" "Frontend Home Page"

# 2. Backend API Health
wait_for_endpoint "${BASE_URL}/api/v1/health" "200" "Backend Health API"

# Verify health payload contains status: ok
if grep -q '"status":"ok"' /tmp/smoke_response.txt; then
  echo "  [PASS] Backend health JSON validated: status == ok"
else
  echo "::error::[FAIL] Backend health response missing expected status: ok"
  exit 1
fi

# 3. Protected API Endpoint Auth Enforcement (401 without Bearer token)
wait_for_endpoint "${BASE_URL}/api/v1/automations" "401" "Protected Endpoint (Unauthenticated)"

echo "=================================================="
echo "All HTTPS smoke tests PASSED successfully."
echo "=================================================="
exit 0
