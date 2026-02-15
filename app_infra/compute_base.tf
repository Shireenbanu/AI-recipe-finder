# ----------------------------------------
# 1. ECR Repository
# ----------------------------------------
resource "aws_ecr_repository" "app" {
  name                 = "${var.project_name}-${var.environment}"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.main.arn 
  }
}

# ----------------------------------------
# 2. Secrets Manager
# ----------------------------------------

# checkov:skip=CKV2_AWS_57: Gemini API keys must be rotated manually in Google AI Studio
resource "aws_secretsmanager_secret" "gemini_key" {
  name        = "${var.project_name}/gemini-api-key"
  description = "Gemini API Key - Rotate manually in Google Console"
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
        Sid    = "S3DataAccess"
        Effect = "Allow"
        # List ONLY what the app actually does. 
        # s3:* is too broad for security scanners.
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        # You need BOTH the bucket and the objects path
        Resource = [
          "arn:aws:s3:::ai-recipe-app-uploads-2026-us-west",
          "arn:aws:s3:::ai-recipe-app-uploads-2026-us-west/*"
        ]
      },
      {
        Sid    = "CloudWatchLogsAccess"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        # Scanners usually accept "*" for logs, but scoped is better:
        Resource = ["${aws_cloudwatch_log_group.ecs.arn}:*"]
      }
    ]
  })
}

# Get current AWS Account ID
data "aws_caller_identity" "current" {}

resource "aws_kms_key" "main" {
  description             = "KMS key for ECR and CloudWatch Logs"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # 1. Allow the Root User (Account Admin) full access so you don't get locked out
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      # 2. Allow CloudWatch Logs to use the key
      {
        Sid    = "Allow CloudWatch Logs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:*"
          }
        }
      },
      # 3. Allow ECR to use the key
      {
        Sid    = "Allow ECR to use the key"
        Effect = "Allow"
        Principal = {
          Service = "ecr.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })
}

# Create an Alias so it's easy to identify in the Console
resource "aws_kms_alias" "main" {
  name          = "alias/${var.project_name}-kms"
  target_key_id = aws_kms_key.main.key_id
}
