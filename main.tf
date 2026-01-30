# ========================================
# Recipe Finder - Infrastructure as Code
# Single File - Deploy Step by Step
# ========================================

# ----------------------------------------
# Variables
# ----------------------------------------
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "recipe-finder"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b"]
}

variable "domain_name" {
  description = "Your domain name"
  type        = string
  default     = "shireenlabs.me"
}

variable "app_port" {
  description = "Application port"
  type        = number
  default     = 80
}

variable "db_password" {
  description = "Master password for RDS"
  type        = string
  default   = 9900126357
}

# ----------------------------------------
# Provider Configuration
# ----------------------------------------
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = "shireens-terminal"
  
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ========================================
# STEP 1: VPC & NETWORKING
# Run: terraform apply -target=aws_vpc.main -target=aws_internet_gateway.main -target=aws_subnet.public -target=aws_subnet.private_data
# ========================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "${var.project_name}-${var.environment}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = {
    Name = "${var.project_name}-${var.environment}-igw"
  }
}

resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true
  
  tags = {
    Name = "${var.project_name}-${var.environment}-public-${var.availability_zones[count.index]}"
    Type = "Public"
  }
}

resource "aws_subnet" "private_data" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 20)
  availability_zone = var.availability_zones[count.index]
  
  tags = {
    Name = "${var.project_name}-${var.environment}-private-data-${var.availability_zones[count.index]}"
    Type = "Private-Data"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private_data" {
  vpc_id = aws_vpc.main.id
  
  tags = {
    Name = "${var.project_name}-${var.environment}-private-data-rt"
  }
}

resource "aws_route_table_association" "private_data" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private_data[count.index].id
  route_table_id = aws_route_table.private_data.id
}

resource "aws_flow_log" "main" {
  iam_role_arn    = aws_iam_role.vpc_flow_log.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_log.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id
  
  tags = {
    Name = "${var.project_name}-${var.environment}-vpc-flow-log"
  }
}

resource "aws_cloudwatch_log_group" "vpc_flow_log" {
  name              = "/aws/vpc/${var.project_name}-${var.environment}"
  retention_in_days = 30
}

resource "aws_iam_role" "vpc_flow_log" {
  name = "${var.project_name}-${var.environment}-vpc-flow-log-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "vpc-flow-logs.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "vpc_flow_log" {
  name = "${var.project_name}-${var.environment}-vpc-flow-log-policy"
  role = aws_iam_role.vpc_flow_log.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Effect = "Allow"
      Resource = [
        aws_cloudwatch_log_group.vpc_flow_log.arn,
        "${aws_cloudwatch_log_group.vpc_flow_log.arn}:*"
      ]
    }]
  })
}

# ========================================
# STEP 2: SECURITY GROUPS
# Run: terraform apply -target=aws_security_group.alb -target=aws_security_group.ecs_tasks -target=aws_security_group.db
# ========================================

# Create security groups first (without rules that reference each other)
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Security group for ALB"
  vpc_id      = aws_vpc.main.id
  
  tags = {
    Name = "${var.project_name}-${var.environment}-alb-sg"
  }
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-${var.environment}-ecs-tasks-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id
  
  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-tasks-sg"
  }
}

resource "aws_security_group" "db" {
  name        = "${var.project_name}-${var.environment}-db-sg"
  description = "Security group for RDS"
  vpc_id      = aws_vpc.main.id
  
  tags = {
    Name = "${var.project_name}-${var.environment}-db-sg"
  }
}

# Now add rules separately (avoids circular dependency)

# ALB ingress rules
resource "aws_security_group_rule" "alb_ingress_https" {
  type              = "ingress"
  description       = "HTTPS from Internet"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "alb_ingress_http" {
  type              = "ingress"
  description       = "HTTP from Internet"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.alb.id
}

# ALB egress to ECS
resource "aws_security_group_rule" "alb_egress_to_ecs" {
  type                     = "egress"
  description              = "To ECS Tasks"
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  security_group_id        = aws_security_group.alb.id
}

# ECS ingress from ALB
resource "aws_security_group_rule" "ecs_ingress_from_alb" {
  type                     = "ingress"
  description              = "From ALB only"
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  security_group_id        = aws_security_group.ecs_tasks.id
}

# ECS egress (all outbound)
resource "aws_security_group_rule" "ecs_egress_all" {
  type              = "egress"
  description       = "All outbound"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.ecs_tasks.id
}

# DB ingress from ECS
resource "aws_security_group_rule" "db_ingress_from_ecs" {
  type                     = "ingress"
  description              = "PostgreSQL from ECS only"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  security_group_id        = aws_security_group.db.id
}

# DB ingress from VPC (for debugging)
resource "aws_security_group_rule" "db_ingress_from_vpc" {
  type              = "ingress"
  description       = "PostgreSQL from VPC"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = [aws_vpc.main.cidr_block]
  security_group_id = aws_security_group.db.id
}

# DB egress
resource "aws_security_group_rule" "db_egress_all" {
  type              = "egress"
  description       = "All outbound"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.db.id
}

# ========================================
# OUTPUTS
# ========================================

output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_data_subnet_ids" {
  value = aws_subnet.private_data[*].id
}

output "security_group_alb" {
  value = aws_security_group.alb.id
}

output "security_group_ecs" {
  value = aws_security_group.ecs_tasks.id
}

output "security_group_db" {
  value = aws_security_group.db.id
}

# ========================================
# STEP 3: RDS DATABASE
# Run: terraform apply -target=aws_db_subnet_group.main -target=aws_db_instance.recipe_db
# ========================================

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-db-subnet-group"
  subnet_ids = aws_subnet.private_data[*].id
  
  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

resource "aws_db_instance" "recipe_db" {
  identifier           = "${var.project_name}-${var.environment}-db"
  engine               = "postgres"
  engine_version       = "15"
  instance_class       = "db.t4g.micro"
  allocated_storage    = 20
  storage_type         = "gp3"
  
  db_name  = "recipedb"
  username = "shireen_admin"
  password = var.db_password
  
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  
  publicly_accessible = false
  skip_final_snapshot = true
  multi_az            = true
  
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"
  
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  tags = {
    Name = "${var.project_name}-${var.environment}-db"
  }
}

output "rds_endpoint" {
  description = "RDS database endpoint"
  value       = aws_db_instance.recipe_db.endpoint
}

output "rds_address" {
  description = "RDS database address"
  value       = aws_db_instance.recipe_db.address
}

output "rds_database_name" {
  description = "RDS database name"
  value       = aws_db_instance.recipe_db.db_name
}

# ========================================
# ECR & ECS RESOURCES ONLY
# Add this to your existing main.tf
# ========================================

# ----------------------------------------
# Additional Variables for ECS
# ----------------------------------------
variable "app_name" {
  description = "Application name"
  type        = string
  default     = "recipe-finder-api"
}

variable "app_cpu" {
  description = "Fargate CPU units (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 512
}

variable "app_memory" {
  description = "Fargate memory in MB (512, 1024, 2048, 4096, 8192)"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 2
}

variable "min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 2
}

variable "max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 10
}

variable "docker_image" {
  description = "Docker image URL (ECR repository URL with tag)"
  type        = string
  default     = ""
}

variable "create_ecs_service" {
  description = "Set to true when ready to deploy ECS service"
  type        = bool
  default     = true
}

# ========================================
# ECR REPOSITORY
# ========================================

resource "aws_ecr_repository" "app" {
  name                 = "${var.project_name}-${var.environment}"
  image_tag_mutability = "MUTABLE"
  
  image_scanning_configuration {
    scan_on_push = true
  }
  
  encryption_configuration {
    encryption_type = "AES256"
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-ecr"
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Remove untagged images after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ========================================
# ECS CLUSTER
# ========================================

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}-cluster"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-cluster"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name
  
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
  
  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# ========================================
# CLOUDWATCH LOGS
# ========================================

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.project_name}-${var.environment}"
  retention_in_days = 30
  
  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-logs"
  }
}

# ========================================
# IAM ROLES & POLICIES
# ========================================

# ECS Task Execution Role (for ECS to pull images, write logs, get secrets)
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.project_name}-${var.environment}-ecs-task-execution-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
  
  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-task-execution-role"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "${var.project_name}-${var.environment}-ecs-secrets-policy"
  role = aws_iam_role.ecs_task_execution_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "ssm:GetParameters",
        "kms:Decrypt"
      ]
      Resource = "*"
    }]
  })
}

# ECS Task Role (for application to access AWS services)
resource "aws_iam_role" "ecs_task_role" {
  name = "${var.project_name}-${var.environment}-ecs-task-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
  
  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-task-role"
  }
}

resource "aws_iam_role_policy" "ecs_task_role_policy" {
  name = "${var.project_name}-${var.environment}-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "s3:PutObjectAcl"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}
# ========================================
# ECS TASK DEFINITION
# ========================================

# 1. Define the Secret Metadata
resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "production/recipe-finder-web/secrets"
  description = "Contains DB credentials and host information"
}

# 2. Upload the JSON file as the secret value
resource "aws_secretsmanager_secret_version" "app_secrets_val" {
  secret_id     = aws_secretsmanager_secret.app_secrets.id
  # trimspace ensures no accidental newlines from the file are uploaded
  secret_string = file("${path.module}/secrets.json")
}

# ========================================
# ECS TASK DEFINITION
# ========================================

resource "aws_ecs_task_definition" "app" {
  count = var.create_ecs_service ? 1 : 0
  
  family                   = "${var.project_name}-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.app_cpu
  memory                   = var.app_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn
  
  container_definitions = jsonencode([{
    name  = var.app_name
    image = var.docker_image != "" ? var.docker_image : "${aws_ecr_repository.app.repository_url}:latest"
    
    
    portMappings = [
        {
          containerPort = 80
          hostPort      = 80 # Must be 80 for Fargate/awsvpc mode
          protocol      = "tcp"
        }
      ]
    
    environment = [
      {
        name  = "NODE_ENV"
        value = var.environment
      },
      {
        name  = "PORT"
        value = tostring(var.app_port)
      },
      {
        name  = "DB_HOST"
        value = aws_db_instance.recipe_db.address
      },
      {
        name  = "DB_PORT"
        value = "5432"
      },
      {
        name  = "DB_NAME"
        value = aws_db_instance.recipe_db.db_name
      },
      {
        name  = "DB_USER"
        value = "shireen_admin"
      },
      {
        name  = "AWS_REGION"
        value = var.aws_region
      },
      { name = "VITE_COGNITO_USER_POOL_ID"
       value = "us-west-2_8hJ9rdYYz"
       },
        { name = "VITE_COGNITO_CLIENT_ID"
          value = "REDACTED_CLIENT_ID"
        },
        { name = "AWS_S3_BUCKET_NAME"
          value = "ai-recipe-app-uploads-2026-us-west" 
        }

    ]
     # 2. SENSITIVE DATA (Secrets from Secrets Manager)
      secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DB_PASSWORD::"
        },
        {
          name      = "GEMINI_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:GEMINI_API_KEY::"
        },
        {
          name      = "AWS_SECRET_ACCESS_KEY"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:AWS_SECRET_ACCESS_KEY::"
        }
      ]
    
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
    
    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:80/ || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
  
  tags = {
    Name = "${var.project_name}-${var.environment}-task-def"
  }
}

# ========================================
# APPLICATION LOAD BALANCER
# Add this section BEFORE your ECS Task Definition
# ========================================

resource "aws_lb" "main" {
  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  
  enable_deletion_protection       = false
  enable_http2                     = true
  enable_cross_zone_load_balancing = true
  
  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

resource "aws_lb_target_group" "app" {
  name        = "${var.project_name}-${var.environment}-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  
  health_check {
    enabled             = true
    path                = "/"        # This matches your curl http://127.0.0.1/
    port                = "traffic-port" # This targets Port 80
    protocol            = "HTTP"
    matcher             = "200-399"  # Accepts any successful status or redirect
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2          # Fewer checks to turn green faster
    unhealthy_threshold = 3
  }
  
  deregistration_delay = 30
  
  tags = {
    Name = "${var.project_name}-${var.environment}-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301" # Permanent redirect
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = aws_acm_certificate_validation.cert.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn # Your port 80 TG
  }
}

# Add this output at the end of your file
output "alb_dns_name" {
  description = "ALB DNS name - use this to access your app"
  value       = aws_lb.main.dns_name
}

# ========================================
# ECS SERVICE
# ========================================

resource "aws_ecs_service" "app" {
  count = var.create_ecs_service ? 1 : 0
  
  name            = "${var.project_name}-${var.environment}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app[0].arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  
  platform_version = "LATEST"
  
  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

   load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = var.app_name
    container_port   = 80
  }
  
  health_check_grace_period_seconds = 60
  
  
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-service"
  }
}

# ========================================
# AUTO SCALING
# ========================================

resource "aws_appautoscaling_target" "ecs" {
  count = var.create_ecs_service ? 1 : 0
  
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app[0].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_cpu" {
  count = var.create_ecs_service ? 1 : 0
  
  name               = "${var.project_name}-${var.environment}-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs[0].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs[0].service_namespace
  
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# ========================================
# OUTPUTS
# ========================================

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.app.repository_url
}

output "ecr_repository_name" {
  description = "ECR repository name"
  value       = aws_ecr_repository.app.name
}

output "ecs_cluster_name" {
  description = "ECS Cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ECS Cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_task_execution_role_arn" {
  description = "ECS Task Execution Role ARN"
  value       = aws_iam_role.ecs_task_execution_role.arn
}

output "ecs_task_role_arn" {
  description = "ECS Task Role ARN"
  value       = aws_iam_role.ecs_task_role.arn
}

output "ecs_service_name" {
  description = "ECS Service name"
  value       = var.create_ecs_service ? aws_ecs_service.app[0].name : "Not created - set create_ecs_service=true"
}

# ----------------------------------------
#  AWS codebuild and code pipleine
# ----------------------------------------


# Create CodeStar connection to GitHub
resource "aws_codestarconnections_connection" "github" {
  name          = "github-connection"
  provider_type = "GitHub"
}

# IAM Role for CodeBuild
resource "aws_iam_role" "codebuild_role" {
  name = "${var.project_name}-codebuild-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codebuild.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy for CodeBuild
resource "aws_iam_role_policy" "codebuild_policy" {
  name = "${var.project_name}-codebuild-policy"
  role = aws_iam_role.codebuild_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # CloudWatch Logs permissions
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = ["*"]
      },
      # ECR permissions (for pushing Docker images)
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetRepositoryPolicy",
          "ecr:DescribeRepositories",
          "ecr:ListImages",
          "ecr:DescribeImages",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]
        Resource = ["*"]
      },
     {
        Effect = "Allow"
        Action = [
          "codebuild:CreateWebhook",
          "codebuild:DeleteWebhook",
          "codebuild:UpdateWebhook",
          "codebuild:ListWebhooks"
        ]
        Resource = [
          "arn:aws:codebuild:us-west-2:045615334997:project/recipe-finder-build"
        ]
      },
      # CodeStar connection permissions
      {
        Effect = "Allow"
        Action = [
          "codestar-connections:UseConnection",
          "codestar-connections:GetConnection",
          "codestar-connections:ListConnections",
          "codestar-connections:PassConnection",
        
        ]
        Resource =  "arn:aws:codestar-connections:us-west-2:045615334997:connection/*"
      },
      # Get ECR repository info
      {
        Effect = "Allow"
        Action = [
          "ecr:DescribeRepositories",
          "ecr:ListImages"
        ]
        Resource = "*"
      }
    ]
  })
}

# CodeBuild Project - Using GitHub with your existing buildspec
resource "aws_codebuild_project" "recipe_finder_build" {
  name          = "recipe-finder-build"
  description   = "Build Recipe Finder Docker image"
  service_role  = aws_iam_role.codebuild_role.arn
  build_timeout = 10

  artifacts {
    type = "NO_ARTIFACTS"
  }

  cache {
    type = "NO_CACHE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type                        = "LINUX_CONTAINER"
    privileged_mode             = true  # REQUIRED for Docker builds
    image_pull_credentials_type = "CODEBUILD"

    
  }

  # Connect to GitHub - It will use the buildspec file from your repo
  source {
    type            = "GITHUB"
    location        = "https://github.com/Shireenbanu/AI-recipe-finder.git"
    git_clone_depth = 1
    buildspec = "buildspec.yml"
    
    git_submodules_config {
      fetch_submodules = false
    }
    

  }

  logs_config {
    cloudwatch_logs {
      group_name  = "/aws/codebuild/recipe-finder"
      stream_name = "build"
    }
  }
}
# ========================================
# ROUTE 53 & SSL CERTIFICATE (ACM)
# ========================================
# ----------------------------------------
# Route 53 Hosted Zone
# ----------------------------------------

resource "aws_route53_zone" "main" {
  name = var.domain_name
  
  tags = {
    Name = "${var.project_name}-${var.environment}-zone"
  }
}

# ----------------------------------------
# ACM Certificate for SSL/TLS
# ----------------------------------------
resource "aws_acm_certificate" "cert" {
  domain_name       = var.domain_name
  validation_method = "DNS"
  subject_alternative_names = ["*.${var.domain_name}"]
  
  lifecycle {
    create_before_destroy = true
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-cert"
  }
}

# ----------------------------------------
# Route 53 Records for Certificate Validation
# ----------------------------------------
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  
  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

# ----------------------------------------
# ACM Certificate Validation
# ----------------------------------------
resource "aws_acm_certificate_validation" "cert" {
  certificate_arn         = aws_acm_certificate.cert.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}