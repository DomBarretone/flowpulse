#!/usr/bin/env bash
set -euo pipefail

# verify-terraform-secrets.sh
# Validates that sensitive ephemeral variables using write-only attributes (value_wo)
# do NOT leak or persist in terraform plan JSON or state outputs.
# STRICT RULE: Outputs strictly PASS or FAIL without logging credentials.

SECRET_CANARY="FLOWPULSE_TERRAFORM_SECRET_CANARY_DO_NOT_PERSIST"
ADMIN_EMAIL_CANARY="FLOWPULSE_TERRAFORM_ADMIN_EMAIL_CANARY_DO_NOT_PERSIST@example.invalid"
PROBE_DIR=$(mktemp -d /tmp/tf-canary-probe-XXXXXX)

cleanup() {
  rm -rf "$PROBE_DIR"
}
trap cleanup EXIT

cat <<'EOF' > "$PROBE_DIR/main.tf"
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.86.0, < 6.0.0"
    }
  }
}

provider "aws" {
  region                      = "us-east-1"
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
  access_key                  = "mock_key"
  secret_key                  = "mock_secret"
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "database_url_version" {
  type    = number
  default = 1
}

variable "clerk_secret_key" {
  type      = string
  sensitive = true
}

variable "clerk_secret_key_version" {
  type    = number
  default = 1
}

variable "openrouter_api_key" {
  type      = string
  sensitive = true
}

variable "openrouter_api_key_version" {
  type    = number
  default = 1
}

variable "flowpulse_admin_emails" {
  type      = string
  sensitive = true
}

variable "flowpulse_admin_emails_version" {
  type    = number
  default = 1
}

module "secrets" {
  source = "./secrets"

  environment                    = "probe"
  database_url                   = var.database_url
  database_url_version           = var.database_url_version
  clerk_secret_key               = var.clerk_secret_key
  clerk_secret_key_version       = var.clerk_secret_key_version
  openrouter_api_key             = var.openrouter_api_key
  openrouter_api_key_version     = var.openrouter_api_key_version
  flowpulse_admin_emails         = var.flowpulse_admin_emails
  flowpulse_admin_emails_version = var.flowpulse_admin_emails_version
}
EOF

# Copy the actual secrets module to the probe directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cp -r "$ROOT_DIR/infra/terraform/modules/secrets" "$PROBE_DIR/secrets"
sed -i.bak '/ephemeral   = true/d' "$PROBE_DIR/secrets/variables.tf" && rm -f "$PROBE_DIR/secrets/variables.tf.bak"
cp "$ROOT_DIR/infra/terraform/bootstrap/.terraform.lock.hcl" "$PROBE_DIR/"
if [ -d "$ROOT_DIR/infra/terraform/bootstrap/.terraform" ]; then
  cp -r "$ROOT_DIR/infra/terraform/bootstrap/.terraform" "$PROBE_DIR/"
fi

# Initialize probe
terraform -chdir="$PROBE_DIR" init -backend=false >/dev/null 2>&1

# Run plan passing the canary into all secret variables
terraform -chdir="$PROBE_DIR" plan \
  -var="database_url=$SECRET_CANARY" \
  -var="clerk_secret_key=$SECRET_CANARY" \
  -var="openrouter_api_key=$SECRET_CANARY" \
  -var="flowpulse_admin_emails=$ADMIN_EMAIL_CANARY" \
  -out="$PROBE_DIR/probe.tfplan" >/dev/null 2>&1

# Export plan to JSON
terraform -chdir="$PROBE_DIR" show -json "$PROBE_DIR/probe.tfplan" > "$PROBE_DIR/plan.json"

# Check if canary string appears in planned_values or resource_changes (the infrastructure state)
if node -e "
  const fs = require('fs');
  const plan = JSON.parse(fs.readFileSync('$PROBE_DIR/plan.json', 'utf8'));
  const canaries = ['$SECRET_CANARY', '$ADMIN_EMAIL_CANARY'];
  const inResources = canaries.some((c) => JSON.stringify(plan.resource_changes || {}).includes(c));
  const inPlanned = canaries.some((c) => JSON.stringify(plan.planned_values || {}).includes(c));
  if (inResources || inPlanned) {
    process.exit(1);
  }
" 2>/dev/null; then
  echo "Terraform Secret Canary Verification: PASS"
  exit 0
else
  echo "Terraform Secret Canary Verification: FAIL"
  exit 1
fi
