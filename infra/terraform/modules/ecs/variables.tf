variable "environment" {
  type        = string
  description = "Deployment environment name"
  default     = "production"
}

variable "aws_region" {
  type        = string
  description = "AWS region for CloudWatch logs"
  default     = "us-east-1"
}

variable "desired_count" {
  type        = number
  description = "Number of ECS task replicas (default 2 for HA, set to 1 for academic cost management)"
  default     = 2
}

variable "api_image_uri" {
  type        = string
  description = "Full URI of the API container image (including commit SHA tag)"
}

variable "web_image_uri" {
  type        = string
  description = "Full URI of the Web container image (including commit SHA tag)"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Subnet IDs where ECS tasks will be launched"
}

variable "ecs_tasks_security_group_id" {
  type        = string
  description = "Security group ID for ECS tasks"
}

variable "api_target_group_arn" {
  type        = string
  description = "ARN of the API target group in ALB"
}

variable "web_target_group_arn" {
  type        = string
  description = "ARN of the Web target group in ALB"
}

variable "database_url_arn" {
  type        = string
  description = "ARN of the database_url SSM parameter"
}

variable "clerk_secret_key_arn" {
  type        = string
  description = "ARN of the clerk_secret_key SSM parameter"
}

variable "openrouter_api_key_arn" {
  type        = string
  description = "ARN of the openrouter_api_key SSM parameter"
}

variable "flowpulse_admin_emails_arn" {
  type        = string
  description = "ARN of the flowpulse_admin_emails SSM parameter"
}

variable "clerk_publishable_key" {
  type        = string
  description = "Clerk publishable key for backend JWT verification"
}

variable "web_origin" {
  type        = string
  description = "Frontend origin URL for CORS configuration"
}

variable "api_cpu" {
  type        = string
  description = "Fargate CPU units for API task"
  default     = "512"
}

variable "api_memory" {
  type        = string
  description = "Fargate memory (MB) for API task"
  default     = "1024"
}

variable "web_cpu" {
  type        = string
  description = "Fargate CPU units for Web task"
  default     = "512"
}

variable "web_memory" {
  type        = string
  description = "Fargate memory (MB) for Web task"
  default     = "1024"
}
