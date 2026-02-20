
# Reference the VPC created in Step 1
# (In a real run, Terraform will know this if it's in the same state)
# If running completely fresh, you'd need the vpc_id from your output.

# ========================================
# 1. SECURITY GROUPS
# ========================================

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Security group for ALB"
  vpc_id      = aws_vpc.main.id # Ensure aws_vpc.main is in your state
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-${var.environment}-ecs-tasks-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "db" {
  name        = "${var.project_name}-${var.environment}-db-sg"
  description = "Security group for RDS"
  vpc_id      = aws_vpc.main.id
}

# ========================================
# 2. SECURITY GROUP RULES (Split to avoid circular dependency)
# ========================================

# ALB Ingress (Allow Web Traffic)
resource "aws_security_group_rule" "alb_ingress_http" {
  # checkov:skip=CKV_AWS_260:Port 80 is required for the ALB to perform HTTP-to-HTTPS redirection.
  type              = "ingress"
  description       = "alb ingress http"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "alb_ingress_https" {
  type              = "ingress"
  description       = "HTTPS from Internet"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.alb.id
}


resource "aws_security_group_rule" "alb_egress_to_ecs" {
  type                     = "egress"
  description              = "To ECS Tasks"
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  security_group_id        = aws_security_group.alb.id
}

# ECS Ingress (Allow traffic ONLY from ALB)
resource "aws_security_group_rule" "ecs_ingress_from_alb" {
  type                     = "ingress"
  description              = "ecs ingress from alb"
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  security_group_id        = aws_security_group.ecs_tasks.id
}

# DB Ingress (Allow traffic ONLY from ECS)
resource "aws_security_group_rule" "db_ingress_from_ecs" {
  type                     = "ingress"
  description              = "From ECS to db"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  security_group_id        = aws_security_group.db.id
}

# Egress (Allow all outbound for ECS so it can pull images/updates)
resource "aws_security_group_rule" "ecs_egress_all" {
  # checkov:skip=CKV_AWS_382:Full egress required for app to communicate with dynamic 3rd party endpoints and legacy internal services.
  type              = "egress"
  description       = "From ECS TO internet"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.ecs_tasks.id
}

resource "aws_security_group_rule" "db_ingress_from_vpc" {
  type              = "ingress"
  description       = "PostgreSQL from VPC"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = [aws_vpc.main.cidr_block]
  security_group_id = aws_security_group.db.id
}

# ========================================
# 3. IAM ROLES (For ECS)
# ========================================

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.project_name}-${var.environment}-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "${var.project_name}-${var.environment}-execution-secrets"
  role = aws_iam_role.ecs_task_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [aws_db_instance.recipe_db.master_user_secret[0].secret_arn,
          aws_secretsmanager_secret.gemini_key.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = [aws_kms_key.main.arn]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}


resource "aws_kms_key" "dnssec" {
  provider                 = aws.us_east_1
  customer_master_key_spec = "ECC_NIST_P256"
  key_usage                = "SIGN_VERIFY"
  description              = "KMS Key for Route 53 DNSSEC"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnableRootAccess"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowRoute53DNSSEC"
        Effect    = "Allow"
        Principal = { Service = "dnssec-route53.amazonaws.com" }
        Action    = ["kms:DescribeKey", "kms:GetPublicKey", "kms:Sign"]
        Resource  = "*"
      }
    ]
  })
}
