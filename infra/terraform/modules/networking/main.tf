resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "flowpulse-${var.environment}-vpc"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "flowpulse-${var.environment}-igw"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "flowpulse-${var.environment}-public-${var.availability_zones[count.index]}"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }

  tags = {
    Name        = "flowpulse-${var.environment}-public-rt"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ALB Security Group: Inbound HTTP/HTTPS from Internet, full egress
resource "aws_security_group" "alb" {
  name        = "flowpulse-${var.environment}-alb-sg"
  description = "Security group for FlowPulse Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from Internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from Internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "flowpulse-${var.environment}-alb-sg"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}

# ECS Tasks Security Group: Inbound ONLY from ALB SG on container ports 3000 & 3001
resource "aws_security_group" "ecs_tasks" {
  name        = "flowpulse-${var.environment}-ecs-tasks-sg"
  description = "Security group for FlowPulse ECS Fargate tasks (ingress restricted to ALB)"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Inbound Web from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Inbound API from ALB"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Allow all outbound traffic (database, third-party APIs, AWS services)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "flowpulse-${var.environment}-ecs-tasks-sg"
    Environment = var.environment
    Project     = "FlowPulse"
    ManagedBy   = "Terraform"
  }
}
