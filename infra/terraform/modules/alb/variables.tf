variable "environment" {
  type        = string
  description = "Deployment environment name"
  default     = "production"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID where target groups are created"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnet IDs where ALB is deployed"
}

variable "alb_security_group_id" {
  type        = string
  description = "Security group ID for the ALB"
}

variable "acm_certificate_arn" {
  type        = string
  description = "ARN of ACM certificate for HTTPS TLS termination on port 443"
}
