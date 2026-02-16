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

# 2. Create the Key Signing Key (KSK)
resource "aws_route53_key_signing_key" "main" {
  provider = aws.us_east_1 
  
  hosted_zone_id             = aws_route53_zone.main.id
  key_management_service_arn = aws_kms_key.dnssec.arn
  name                       = "ksk-${var.project_name}"
  status                     = "ACTIVE"
}

# 3. Enable DNSSEC Signing
resource "aws_route53_hosted_zone_dnssec" "main" {
  provider = aws.us_east_1
  
  hosted_zone_id = aws_route53_key_signing_key.main.hosted_zone_id
  
  depends_on = [aws_route53_key_signing_key.main]
}

# 1. Create a CloudWatch Log Group (MUST be in us-east-1)
resource "aws_cloudwatch_log_group" "dns_query_log" {
  provider          = aws.us_east_1 # Using the alias we set up earlier
  name              = "/aws/route53/${var.domain_name}"
  retention_in_days = 30
}

# 2. Add a Resource Policy to allow Route 53 to write logs
# This is required or the logging will fail to start
resource "aws_cloudwatch_log_resource_policy" "route53_query_logging_policy" {
  provider        = aws.us_east_1
  policy_name     = "route53-query-logging-policy"
  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "route53.amazonaws.com"
        }
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.dns_query_log.arn}:*"
      }
    ]
  })
}

# 3. Enable the Query Log for your Hosted Zone (Satisfies Checkov)
resource "aws_route53_query_log" "main" {
  depends_on               = [aws_cloudwatch_log_resource_policy.route53_query_logging_policy]
  cloudwatch_log_group_arn = aws_cloudwatch_log_group.dns_query_log.arn
  zone_id                  = aws_route53_zone.main.zone_id
}