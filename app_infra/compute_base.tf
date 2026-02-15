# ----------------------------------------
# 1. ECR Repository
# ----------------------------------------
resource "aws_ecr_repository" "app" {
  name                 = "${var.project_name}-${var.environment}"
  image_tag_mutability = "MUTABLE"
  
  image_scanning_configuration {
    scan_on_push = true
  }
}

# ----------------------------------------
# 2. Secrets Manager
# ----------------------------------------
resource "aws_secretsmanager_secret" "app_secrets"{
  name        = "${var.project_name}/${var.environment}/secrets_1"
  description = "Secrets for Recipe Finder App"
}

# 2. Upload the JSON file as the secret value
resource "aws_secretsmanager_secret_version" "app_secrets_val" {
  secret_id     = aws_secretsmanager_secret.app_secrets.id
  # trimspace ensures no accidental newlines from the file are uploaded
  secret_string = file("${path.module}/secrets.json")
}

# ----------------------------------------
# 3. ECS Task Role (Permissions for the APP)
# ----------------------------------------
resource "aws_iam_role" "ecs_task_role" {
  name = "${var.project_name}-${var.environment}-ecs-task-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

# Allow the app to talk to S3 and Secrets (Adjust as needed)
resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "${var.project_name}-${var.environment}-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:*", "secretsmanager:GetSecretValue"]
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