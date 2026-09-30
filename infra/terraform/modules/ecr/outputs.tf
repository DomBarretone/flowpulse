output "api_repository_url" {
  description = "The URL of the API ECR repository"
  value       = aws_ecr_repository.api.repository_url
}

output "web_repository_url" {
  description = "The URL of the Web ECR repository"
  value       = aws_ecr_repository.web.repository_url
}

output "api_repository_arn" {
  description = "The ARN of the API ECR repository"
  value       = aws_ecr_repository.api.arn
}

output "web_repository_arn" {
  description = "The ARN of the Web ECR repository"
  value       = aws_ecr_repository.web.arn
}
