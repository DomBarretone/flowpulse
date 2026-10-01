output "bucket_name" {
  description = "The name of the remote state S3 bucket"
  value       = aws_s3_bucket.state.id
}

output "bucket_arn" {
  description = "The ARN of the remote state S3 bucket"
  value       = aws_s3_bucket.state.arn
}

output "aws_region" {
  description = "The AWS region of the remote state bucket"
  value       = var.aws_region
}
