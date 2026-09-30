output "alb_dns_name" {
  description = "The public DNS name of the Application Load Balancer"
  value       = module.alb.alb_dns_name
}

output "api_repository_url" {
  description = "The ECR repository URL for the API image"
  value       = module.ecr.api_repository_url
}

output "web_repository_url" {
  description = "The ECR repository URL for the Web image"
  value       = module.ecr.web_repository_url
}

output "ecs_cluster_name" {
  description = "The name of the production ECS cluster"
  value       = module.ecs.cluster_name
}

output "api_service_name" {
  description = "The name of the production API ECS service"
  value       = module.ecs.api_service_name
}

output "web_service_name" {
  description = "The name of the production Web ECS service"
  value       = module.ecs.web_service_name
}
