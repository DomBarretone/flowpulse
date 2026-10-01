output "cluster_id" {
  description = "The ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "The name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "api_service_name" {
  description = "The name of the API ECS service"
  value       = aws_ecs_service.api.name
}

output "web_service_name" {
  description = "The name of the Web ECS service"
  value       = aws_ecs_service.web.name
}
