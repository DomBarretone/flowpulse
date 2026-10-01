variable "environment" {
  type        = string
  description = "Deployment environment name"
  default     = "production"
}

variable "database_url" {
  type        = string
  description = "PostgreSQL direct connection string"
  sensitive   = true
  ephemeral   = true
}

variable "database_url_version" {
  type        = number
  description = "Version counter for database_url write-only updates"
  default     = 1
}

variable "clerk_secret_key" {
  type        = string
  description = "Clerk Secret Key for backend authentication"
  sensitive   = true
  ephemeral   = true
}

variable "clerk_secret_key_version" {
  type        = number
  description = "Version counter for clerk_secret_key write-only updates"
  default     = 1
}

variable "openrouter_api_key" {
  type        = string
  description = "OpenRouter API Key for AI incident analysis"
  sensitive   = true
  ephemeral   = true
}

variable "openrouter_api_key_version" {
  type        = number
  description = "Version counter for openrouter_api_key write-only updates"
  default     = 1
}

variable "flowpulse_admin_emails" {
  type        = string
  description = "Comma-separated list of authorized admin emails for RBAC promotion"
  sensitive   = true
  ephemeral   = true
}

variable "flowpulse_admin_emails_version" {
  type        = number
  description = "Version counter for flowpulse_admin_emails write-only updates"
  default     = 1
}
