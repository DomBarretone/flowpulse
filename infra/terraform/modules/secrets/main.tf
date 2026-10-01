resource "aws_ssm_parameter" "database_url" {
  name             = "/flowpulse/${var.environment}/database-url"
  type             = "SecureString"
  value_wo         = var.database_url
  value_wo_version = var.database_url_version

  tags = {
    Name        = "flowpulse-${var.environment}-database-url"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

resource "aws_ssm_parameter" "clerk_secret_key" {
  name             = "/flowpulse/${var.environment}/clerk-secret-key"
  type             = "SecureString"
  value_wo         = var.clerk_secret_key
  value_wo_version = var.clerk_secret_key_version

  tags = {
    Name        = "flowpulse-${var.environment}-clerk-secret-key"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

resource "aws_ssm_parameter" "openrouter_api_key" {
  name             = "/flowpulse/${var.environment}/openrouter-api-key"
  type             = "SecureString"
  value_wo         = var.openrouter_api_key
  value_wo_version = var.openrouter_api_key_version

  tags = {
    Name        = "flowpulse-${var.environment}-openrouter-api-key"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

resource "aws_ssm_parameter" "flowpulse_admin_emails" {
  name             = "/flowpulse/${var.environment}/admin-emails"
  type             = "SecureString"
  value_wo         = var.flowpulse_admin_emails
  value_wo_version = var.flowpulse_admin_emails_version

  tags = {
    Name        = "flowpulse-${var.environment}-admin-emails"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}
