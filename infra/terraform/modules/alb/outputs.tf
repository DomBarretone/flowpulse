output "alb_arn" {
  description = "The ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "The DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "The canonical hosted zone ID of the load balancer"
  value       = aws_lb.main.zone_id
}

output "api_target_group_arn" {
  description = "The ARN of the API target group"
  value       = aws_lb_target_group.api.arn
}

output "web_target_group_arn" {
  description = "The ARN of the Web target group"
  value       = aws_lb_target_group.web.arn
}

output "https_listener_arn" {
  description = "The ARN of the HTTPS port 443 listener"
  value       = aws_lb_listener.https.arn
}
