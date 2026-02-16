

# Create CodeStar connection to GitHub
resource "aws_codestarconnections_connection" "github" {
  name          = "github-connection"
  provider_type = "GitHub"
}

# IAM Role for CodeBuild
resource "aws_iam_role" "codebuild_role" {
  name = "${var.project_name}-codebuild-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codebuild.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy for CodeBuild
resource "aws_iam_role_policy" "codebuild_policy" {
  name = "${var.project_name}-codebuild-policy"
  role = aws_iam_role.codebuild_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # 1. CloudWatch Logs (Restricted to this project's log group)
      {
        Sid    = "AllowCloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/codebuild/${var.project_name}-build",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/codebuild/${var.project_name}-build:*"
        ]
      },
      # 2. ECR Write Permissions (Restricted to specific repository)
      {
        Sid    = "AllowECRPushPull"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
          "ecr:DescribeRepositories",
          "ecr:ListImages",
          "ecr:DescribeImages"
        ]
        Resource = ["arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/${var.project_name}-app"]
      },
      # 3. ECR Auth (This action does NOT support resource-level permissions and MUST use *)
      {
        # checkov:skip=CKV_AWS_355:Wildcard is required for service-level actions that do not support resource-level constraints.
        Sid    = "AllowECRAuth"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*" 
      },
      # 4. CodeBuild Webhook & Connection (Already restricted in your snippet)
      {
        Sid    = "AllowCodeBuildAndConnections"
        Effect = "Allow"
        Action = [
          "codebuild:CreateWebhook",
          "codebuild:DeleteWebhook",
          "codebuild:UpdateWebhook",
          "codebuild:ListWebhooks",
          "codestar-connections:UseConnection"
        ]
        Resource = [
          "arn:aws:codebuild:${var.aws_region}:${data.aws_caller_identity.current.account_id}:project/${var.project_name}-build",
          "arn:aws:codestar-connections:${var.aws_region}:${data.aws_caller_identity.current.account_id}:connection/*"
        ]
      }
    ]
  })
}

# CodeBuild Project - Using GitHub with your existing buildspec
resource "aws_codebuild_project" "recipe_finder_build" {
  name          = "recipe-finder-build"
  description   = "Build Recipe Finder Docker image"
  service_role  = aws_iam_role.codebuild_role.arn
  build_timeout = 10

  artifacts {
    type = "NO_ARTIFACTS"
  }

  cache {
    type = "NO_CACHE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type                        = "LINUX_CONTAINER"
    # checkov:skip=BC-AWS-316:Privileged mode is required for Docker-in-Docker to build application images.
    # checkov:skip=CKV_AWS_212:Docker-in-Docker requires privileged access to the host kernel.
    privileged_mode             = true  # REQUIRED for Docker builds
    image_pull_credentials_type = "CODEBUILD"

    
  }

  # Connect to GitHub - It will use the buildspec file from your repo
  source {
    type            = "GITHUB"
    location        = "https://github.com/Shireenbanu/AI-recipe-finder.git"
    git_clone_depth = 1
    buildspec = "buildspec.yml"
    
    git_submodules_config {
      fetch_submodules = false
    }
    

  }

  logs_config {
    cloudwatch_logs {
      group_name  = "/aws/codebuild/recipe-finder"
      stream_name = "build"
    }
  }
}