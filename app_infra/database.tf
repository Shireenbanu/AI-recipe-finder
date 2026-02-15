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
  identifier           = "${var.project_name}-${var.environment}-db"
  engine               = "postgres"
  engine_version       = "15"
  instance_class       = "db.t4g.micro" # Burstable arm64 (Cost-effective)
  allocated_storage    = 20
  storage_type         = "gp3"
  
  db_name  = "recipedb"
  username = "shireen_admin"
  password = var.db_password # This will be prompted or pulled from your vars
  
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  
  publicly_accessible = false  # Keep it in the private subnet
  skip_final_snapshot = true   # Set to false for production use
  multi_az            = true   # High availability for your prod environment
  
  backup_retention_period = 7
  
  tags = {
    Name = "${var.project_name}-${var.environment}-db"
  }
}

# ----------------------------------------
# Outputs for Database
# ----------------------------------------
output "rds_endpoint" {
  value = aws_db_instance.recipe_db.endpoint
}