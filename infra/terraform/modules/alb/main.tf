resource "aws_lb" "main" {
  name               = "flowpulse-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = false

  tags = {
    Name        = "flowpulse-${var.environment}-alb"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

# Web Target Group (Next.js port 3000)
resource "aws_lb_target_group" "web" {
  name        = "flowpulse-${var.environment}-tg-web"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    port                = "3000"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name        = "flowpulse-${var.environment}-tg-web"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

# API Target Group (NestJS port 3001)
resource "aws_lb_target_group" "api" {
  name        = "flowpulse-${var.environment}-tg-api"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/v1/health"
    port                = "3001"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name        = "flowpulse-${var.environment}-tg-api"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

# HTTP Port 80 Listener: Permanent HTTP_301 Redirect to HTTPS Port 443
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = {
    Name        = "flowpulse-${var.environment}-http-listener"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

# HTTPS Port 443 Listener: SSL termination via ACM, default forward to Web
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  tags = {
    Name        = "flowpulse-${var.environment}-https-listener"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

# Path-based routing: /api/* routes to API target group
resource "aws_lb_listener_rule" "api_routing" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }

  tags = {
    Name        = "flowpulse-${var.environment}-rule-api"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}
