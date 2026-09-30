#!/usr/bin/env bash
set -euo pipefail

# verify-docker-context.sh
# Two-level build context security verification:
# Level A: Build-context sentinel probe (asserts excluded sentinels are not ingested)
# Level B: Final image inspection (asserts absence of sensitive artifacts in built images)
# STRICT RULE: NEVER log secret values. Only output PASS or FAIL.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-all}"
IMAGE_TAG_API="${2:-flowpulse-api:test}"
IMAGE_TAG_WEB="${3:-flowpulse-web:test}"

run_level_a_probe() {
  echo "==> [Level A] Running build-context sentinel probe..."
  
  # 1. Setup temporary synthetic sentinel files
  SENTINEL_TOKEN="SYNTHETIC_CANARY_$(date +%s)_PROBE"
  mkdir -p playwright/.auth
  
  echo "SENTINEL=${SENTINEL_TOKEN}" > .env.sentinel
  echo "LOCAL_SENTINEL=${SENTINEL_TOKEN}" > .env.local.sentinel
  echo "{\"token\": \"${SENTINEL_TOKEN}\"}" > playwright/.auth/canary.json
  
  CLEANUP() {
    rm -f .env.sentinel .env.local.sentinel playwright/.auth/canary.json
  }
  trap CLEANUP EXIT
  
  # 2. Build minimal probe image that copies root context
  PROBE_IMAGE="flowpulse-context-probe:test"
  docker build -q -t "$PROBE_IMAGE" -f - . <<'EOF' >/dev/null
FROM alpine:3.21
WORKDIR /probe
COPY . .
EOF

  # 3. Check for presence of sentinels in probe image
  LEAK_FOUND=0
  
  if docker run --rm "$PROBE_IMAGE" test -f /probe/.env.sentinel 2>/dev/null; then
    echo "FAIL: .env.sentinel was copied into container context!"
    LEAK_FOUND=1
  fi

  if docker run --rm "$PROBE_IMAGE" test -f /probe/.env.local.sentinel 2>/dev/null; then
    echo "FAIL: .env.local.sentinel was copied into container context!"
    LEAK_FOUND=1
  fi

  if docker run --rm "$PROBE_IMAGE" test -f /probe/playwright/.auth/canary.json 2>/dev/null; then
    echo "FAIL: playwright/.auth/canary.json was copied into container context!"
    LEAK_FOUND=1
  fi

  if docker run --rm "$PROBE_IMAGE" test -f /probe/.env 2>/dev/null; then
    echo "FAIL: .env was copied into container context!"
    LEAK_FOUND=1
  fi

  # Clean up probe image
  docker rmi "$PROBE_IMAGE" >/dev/null 2>&1 || true

  if [ "$LEAK_FOUND" -ne 0 ]; then
    echo "==> [Level A] Build-context sentinel probe: FAIL"
    return 1
  fi

  echo "==> [Level A] Build-context sentinel probe: PASS"
  return 0
}

run_level_b_inspection() {
  local image="$1"
  local name="$2"
  echo "==> [Level B] Inspecting final image for sensitive artifacts: $name ($image)..."

  # Check if image exists
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    echo "SKIP: Image $image not found locally. Skipping Level B for $name."
    return 0
  fi

  INSPECTION_FAILED=0

  # Test for presence of .env files anywhere in /app
  if docker run --rm "$image" sh -c "find / -maxdepth 4 -name '.env*' ! -name '.env.example' 2>/dev/null | grep -q '.'" 2>/dev/null; then
    echo "FAIL: .env file found in $name image!"
    INSPECTION_FAILED=1
  fi

  # Test for playwright auth
  if docker run --rm "$image" sh -c "test -d /app/playwright/.auth || test -d /playwright/.auth" 2>/dev/null; then
    echo "FAIL: playwright/.auth directory found in $name image!"
    INSPECTION_FAILED=1
  fi

  # Test for test results and coverage
  if docker run --rm "$image" sh -c "test -d /app/coverage || test -d /app/test-results" 2>/dev/null; then
    echo "FAIL: test or coverage results found in $name image!"
    INSPECTION_FAILED=1
  fi

  # Test for git directory
  if docker run --rm "$image" sh -c "test -d /app/.git || test -d /.git" 2>/dev/null; then
    echo "FAIL: .git directory found in $name image!"
    INSPECTION_FAILED=1
  fi

  if [ "$INSPECTION_FAILED" -ne 0 ]; then
    echo "==> [Level B] Final image inspection ($name): FAIL"
    return 1
  fi

  echo "==> [Level B] Final image inspection ($name): PASS"
  return 0
}

case "$MODE" in
  probe|level-a)
    run_level_a_probe
    ;;
  inspect|level-b)
    run_level_b_inspection "$IMAGE_TAG_API" "API"
    run_level_b_inspection "$IMAGE_TAG_WEB" "Web"
    ;;
  all)
    run_level_a_probe
    run_level_b_inspection "$IMAGE_TAG_API" "API"
    run_level_b_inspection "$IMAGE_TAG_WEB" "Web"
    ;;
  *)
    echo "Usage: $0 [probe|inspect|all] [api_image] [web_image]"
    exit 1
    ;;
esac
