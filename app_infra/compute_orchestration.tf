resource "aws_lb" "main" {
  #checkov:skip=CKV_AWS_192:Application is Node.js/React; no Java/Log4j dependency.
  #checkov:skip=CKV2_AWS_76:ALB does not require WAF Log4j protection for non-Java app.  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  drop_invalid_header_fields = true

  enable_deletion_protection       = true
  enable_http2                     = true
  enable_cross_zone_load_balancing = true
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb-logs"
    enabled = true
  }
  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

resource "aws_lb_target_group" "app" {
  name        = "${var.project_name}-${var.environment}-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health" # This matches your curl http://127.0.0.1/
    port                = 8080      # This targets Port 80
    protocol            = "HTTP"
    matcher             = "200-399" # Accepts any successful status or redirect
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2 # Fewer checks to turn green faster
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-tg"
  }
}


# 1. HTTP Listener - Redirects all port 80 traffic to HTTPS 443
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
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.cert.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_s3_bucket" "alb_logs" {
  #checkov:skip=CKV_AWS_145:ALB access logs do not support SSE-KMS; they require SSE-S3 (AES256) for delivery.
  #checkov:skip=CKV_AWS_144:Cross-region replication not required for diagnostic logs.
  #checkov:skip=CKV2_AWS_62:Event notifications too noisy for high-traffic ALB logs.
  #checkov:skip=CKV_AWS_18:This is the logging bucket; self-logging not required.
  bucket        = "${var.project_name}-${var.environment}-alb-logs"
  force_destroy = true
}

resource "aws_s3_bucket_versioning" "alb_logs_versioning" {
  bucket = aws_s3_bucket.alb_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs_encryption" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    apply_server_side_encryption_by_default {
      # checkov:skip=CKV_AWS_145:ALB Access Logs do not support SSE-KMS; must use AES256
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs_pab" {
  bucket = aws_s3_bucket.alb_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs_lifecycle" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    id     = "log_retention"
    status = "Enabled"

    filter {
      prefix = ""
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
    expiration {
      days = 90
    }
  }
}

resource "aws_s3_bucket_logging" "alb_logs_self_logging" {
  # checkov:skip=CKV_AWS_18:This is the logging bucket itself.
  bucket        = aws_s3_bucket.alb_logs.id
  target_bucket = aws_s3_bucket.alb_logs.id
  target_prefix = "log-access-logs/"
}
