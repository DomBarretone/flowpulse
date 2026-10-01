variable "aws_region" {
  type        = string
  description = "AWS region for the remote state S3 bucket"
  default     = "us-east-1"
}

variable "bucket_name" {
  type        = string
  description = "Unique name of the S3 bucket for Terraform remote state"
  default     = "flowpulse-terraform-state"
}
