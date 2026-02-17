# ----------------------------------------
# 1. Database Subnet Group
# ----------------------------------------
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-db-subnet-group"
  subnet_ids = aws_subnet.private_data[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

resource "aws_db_parameter_group" "recipe_db_params" {
  name   = "${var.project_name}-postgres15-params"
  family = "postgres15"

  parameter {
    name  = "log_statement"
    value = "all" # Logs all SQL statements; use "ddl" or "mod" for less noise
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Logs any query taking longer than 1 second (1000ms)
  }
}

resource "aws_iam_role" "rds_monitoring" {
  name = "rds-enhanced-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ----------------------------------------
# 2. RDS Instance (PostgreSQL)
# ----------------------------------------
resource "aws_db_instance" "recipe_db" {
   # checkov:skip=BC-AWS-354:KMS key for Performance Insights is immutable after creation. Using default AWS key.
  # checkov:skip=CKV_AWS_133:Cannot update Performance Insights KMS key on existing DB.
  identifier        = "${var.project_name}-${var.environment}-db"
  engine            = "postgres"
  engine_version    = "15"
  instance_class    = "db.t4g.micro" # Burstable arm64 (Cost-effective)
  allocated_storage = 20
  storage_type      = "gp3"

  db_name                     = "recipedb"
  username                    = "shireen_admin"
  manage_master_user_password = true
  db_subnet_group_name        = aws_db_subnet_group.main.name
  vpc_security_group_ids      = [aws_security_group.db.id]
  publicly_accessible = false # Keep it in the private subnet
  skip_final_snapshot = true  # Set to false for production use
  multi_az            = true  # High availability for your prod environment
  performance_insights_enabled          = true
  performance_insights_retention_period = 7  # 7 days is the Free Tier
  deletion_protection = true
  tags = {
    Name = "${var.project_name}-${var.environment}-db"
  }

  parameter_group_name            = aws_db_parameter_group.recipe_db_params.name
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"] # Fixes CKV_AWS_129
  
  # 2. Monitoring (Fixes CKV_AWS_118)
  monitoring_interval = 60 # Collect metrics every 60 seconds
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # 3. Security & Auth
  storage_encrypted               = true # Fixes CKV_AWS_16
  kms_key_id                      = aws_kms_key.main.arn # Reusing your log key
  iam_database_authentication_enabled = true # Fixes CKV_AWS_161

  # 4. Maintenance & Backups
  copy_tags_to_snapshot       = true # Fixes CKV2_AWS_60
  auto_minor_version_upgrade  = true # Fixes CKV_AWS_226
}

# This resource "claims" the RDS secret and enforces the 30-day rotation
resource "aws_secretsmanager_secret_rotation" "db_rotation" {
  # Points to the secret RDS made for you
  secret_id = aws_db_instance.recipe_db.master_user_secret[0].secret_arn

  rotation_rules {
    automatically_after_days = 30
  }
  
 
}


# ----------------------------------------
# Outputs for Database
# ----------------------------------------
output "rds_endpoint" {
  value = aws_db_instance.recipe_db.endpoint
}
