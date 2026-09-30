output "database_url_arn" {
  description = "The ARN of the database_url SSM parameter"
  value       = aws_ssm_parameter.database_url.arn
}

output "clerk_secret_key_arn" {
  description = "The ARN of the clerk_secret_key SSM parameter"
  value       = aws_ssm_parameter.clerk_secret_key.arn
}

output "openrouter_api_key_arn" {
  description = "The ARN of the openrouter_api_key SSM parameter"
  value       = aws_ssm_parameter.openrouter_api_key.arn
}

output "ssm_parameter_arns" {
  description = "List of all secret SSM parameter ARNs for IAM policy"
  value = [
    aws_ssm_parameter.database_url.arn,
    aws_ssm_parameter.clerk_secret_key.arn,
    aws_ssm_parameter.openrouter_api_key.arn,
  ]
}
