resource "aws_ecs_cluster" "main" {
  name = "flowpulse-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "flowpulse-${var.environment}-cluster"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/flowpulse-${var.environment}-api"
  retention_in_days = 30

  tags = {
    Name        = "flowpulse-${var.environment}-api-logs"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/flowpulse-${var.environment}-web"
  retention_in_days = 30

  tags = {
    Name        = "flowpulse-${var.environment}-web-logs"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

# IAM Execution Role (used by ECS agent to pull images and fetch SSM secrets)
resource "aws_iam_role" "ecs_execution_role" {
  name = "flowpulse-${var.environment}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "flowpulse-${var.environment}-ecs-execution-role"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_standard" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_ssm" {
  name = "flowpulse-${var.environment}-ecs-ssm-secrets-policy"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]
        Resource = [
          var.database_url_arn,
          var.clerk_secret_key_arn,
          var.openrouter_api_key_arn,
          var.flowpulse_admin_emails_arn
        ]
      }
    ]
  })
}

# IAM Task Role (used by application container at runtime)
resource "aws_iam_role" "ecs_task_role" {
  name = "flowpulse-${var.environment}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "flowpulse-${var.environment}-ecs-task-role"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

# API Task Definition
resource "aws_ecs_task_definition" "api" {
  family                   = "flowpulse-${var.environment}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "flowpulse-api"
      image     = var.api_image_uri
      essential = true
      portMappings = [
        {
          containerPort = 3001
          hostPort      = 3001
          protocol      = "tcp"
        }
      ]
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = var.database_url_arn
        },
        {
          name      = "CLERK_SECRET_KEY"
          valueFrom = var.clerk_secret_key_arn
        },
        {
          name      = "OPENROUTER_API_KEY"
          valueFrom = var.openrouter_api_key_arn
        },
        {
          name      = "FLOWPULSE_ADMIN_EMAILS"
          valueFrom = var.flowpulse_admin_emails_arn
        }
      ]
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "3001"
        },
        {
          name  = "CLERK_PUBLISHABLE_KEY"
          value = var.clerk_publishable_key
        },
        {
          name  = "WEB_ORIGIN"
          value = var.web_origin
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"fetch('http://localhost:3001/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 15
      }
    }
  ])

  tags = {
    Name        = "flowpulse-${var.environment}-api-task"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

# Web Task Definition
resource "aws_ecs_task_definition" "web" {
  family                   = "flowpulse-${var.environment}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "flowpulse-web"
      image     = var.web_image_uri
      essential = true
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
      secrets = [
        {
          name      = "CLERK_SECRET_KEY"
          valueFrom = var.clerk_secret_key_arn
        }
      ]
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "3000"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "web"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 15
      }
    }
  ])

  tags = {
    Name        = "flowpulse-${var.environment}-web-task"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

# ECS Service: API
resource "aws_ecs_service" "api" {
  name            = "flowpulse-${var.environment}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.ecs_tasks_security_group_id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = var.api_target_group_arn
    container_name   = "flowpulse-api"
    container_port   = 3001
  }

  deployment_controller {
    type = "ECS"
  }

  tags = {
    Name        = "flowpulse-${var.environment}-api-service"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

# ECS Service: Web
resource "aws_ecs_service" "web" {
  name            = "flowpulse-${var.environment}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.ecs_tasks_security_group_id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = var.web_target_group_arn
    container_name   = "flowpulse-web"
    container_port   = 3000
  }

  deployment_controller {
    type = "ECS"
  }

  tags = {
    Name        = "flowpulse-${var.environment}-web-service"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}
