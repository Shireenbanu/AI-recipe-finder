

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
      # CloudWatch Logs permissions
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = ["*"]
      },
      # ECR permissions (for pushing Docker images)
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetRepositoryPolicy",
          "ecr:DescribeRepositories",
          "ecr:ListImages",
          "ecr:DescribeImages",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]
        Resource = ["*"]
      },
     {
        Effect = "Allow"
        Action = [
          "codebuild:CreateWebhook",
          "codebuild:DeleteWebhook",
          "codebuild:UpdateWebhook",
          "codebuild:ListWebhooks"
        ]
        Resource = [
          "arn:aws:codebuild:us-west-2:045615334997:project/recipe-finder-build"
        ]
      },
      # CodeStar connection permissions
      {
        Effect = "Allow"
        Action = [
          "codestar-connections:UseConnection",
          "codestar-connections:GetConnection",
          "codestar-connections:ListConnections",
          "codestar-connections:PassConnection",
        
        ]
        Resource =  "arn:aws:codestar-connections:us-west-2:045615334997:connection/*"
      },
      # Get ECR repository info
      {
        Effect = "Allow"
        Action = [
          "ecr:DescribeRepositories",
          "ecr:ListImages"
        ]
        Resource = "*"
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