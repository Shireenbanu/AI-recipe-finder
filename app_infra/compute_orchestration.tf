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

# 2. HTTPS Listener - Handles secure traffic and forwards to the app
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08" # Standard AWS policy
  certificate_arn   =  aws_acm_certificate_validation.cert.certificate_arn      # REQUIRED: You must have an ACM certificate ARN

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}


