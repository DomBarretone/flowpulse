variable "aws_region" {
  type        = string
  description = "AWS region for resources"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment name"
  default     = "production"
}

variable "desired_count" {
  type        = number
  description = "Number of ECS task replicas for high availability (default 2, reducible to 1 for academic cost management)"
  default     = 2
}

variable "api_image_tag" {
  type        = string
  description = "Immutable Git commit SHA or image tag for API container"
}

variable "web_image_tag" {
  type        = string
  description = "Immutable Git commit SHA or image tag for Web container"
}

variable "acm_certificate_arn" {
  type        = string
  description = "ARN of ACM certificate for HTTPS termination on ALB port 443"
}

variable "clerk_publishable_key" {
  type        = string
  description = "Public Clerk publishable key"
}

variable "web_origin" {
  type        = string
  description = "Public Web frontend origin URL for CORS configuration"
}

# Runtime secrets managed via SSM Parameter Store with zero persistence in Terraform state
variable "database_url" {
  type        = string
  description = "PostgreSQL direct port 5432 session connection string"
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
  description = "Clerk secret key for backend authentication"
  sensitive   = true
  ephemeral   = true
}

variable "clerk_secret_key_version" {
  type        = number
  description = "Version counter for clerk_secret_key write-only updates"
  default     = 2
}

variable "openrouter_api_key" {
  type        = string
  description = "OpenRouter API key for AI incident analysis"
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
  default     = 2
}
