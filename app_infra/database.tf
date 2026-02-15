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

# ----------------------------------------
# 2. RDS Instance (PostgreSQL)
# ----------------------------------------
resource "aws_db_instance" "recipe_db" {
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

  tags = {
    Name = "${var.project_name}-${var.environment}-db"
  }
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
