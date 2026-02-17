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


# 1. ECS Task Definition (The Blueprint)
resource "aws_ecs_task_definition" "app" {
  family                   = "${var.project_name}-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([{
    name  = var.project_name
    image = "${aws_ecr_repository.app.repository_url}:latest"

    portMappings = [{
      containerPort = 80
      hostPort      = 80
      protocol      = "tcp"
    }]

    # Connect to the DB we created in Step 3
    environment = [
      { name = "DB_HOST", value = aws_db_instance.recipe_db.address },
      { name = "DB_NAME", value = "recipedb" },
      { name = "DB_USER", value = "shireen_admin" },
      { name = "PORT", value = "80" },
      { name = "NODE_ENV", value = var.environment },
      { name = "AWS_REGION", value = "us-west-2" },
      { name = "AWS_S3_BUCKET_NAME", value = "ai-recipe-app-uploads-2026-us-west"}
    ]

  secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = "${aws_db_instance.recipe_db.master_user_secret[0].secret_arn}:password::"
        },
        {
          name      = "GEMINI_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.gemini_key.arn}:GEMINI_API_KEY::"
        }
      ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.project_name}-${var.environment}"
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
  tags = {
    Name = "${var.project_name}-${var.environment}-task-def"
  }
  }])
}

# 2. CloudWatch Log Group (Must exist for logs to work)
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.project_name}-${var.environment}"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.main.arn 
}

# 3. ECS Service (The Process)
resource "aws_ecs_service" "app" {
#checkov:skip=BC-AWS-333:Public IP required to pull ECR images without NAT Gateway costs.
#checkov:skip=CKV_AWS_333:Public IP required to call Gemini API without NAT Gateway.

  name            = "${var.project_name}-${var.environment}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
   assign_public_ip = true # Required since they are in public subnets
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = var.project_name
    container_port   = 80
  }

  

  depends_on = [aws_lb_listener.http]
}
