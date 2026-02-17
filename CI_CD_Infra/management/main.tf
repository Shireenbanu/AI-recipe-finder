provider "aws" {
  region = "us-west-2"
}

variable "aws_region" {
  type    = string
  default = "us-west-2"
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "jenkins_role" {
  name = "jenkins-management-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_instance_profile" "jenkins_profile" {
  name = "jenkins-instance-profile"
  role = aws_iam_role.jenkins_role.name
}

resource "aws_iam_role_policy_attachment" "jenkins_ssm" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  role       = aws_iam_role.jenkins_role.name
}

resource "aws_iam_role_policy" "jenkins_ecs_update_only" {
  name = "JenkinsECSUpdatePolicy"
  role = aws_iam_role.jenkins_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService",
          "iam:PassRole" 
        ]
        Resource = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/recipe-finder-prod-cluster/recipe-finder-prod-service"

      }
    ]
  })
}

# Attach the ECR PowerUser policy to your existing Jenkins role
resource "aws_iam_role_policy_attachment" "jenkins_ecr_access" {
  role       = aws_iam_role.jenkins_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
}

resource "aws_security_group" "jenkins_sg" {
  name        = "jenkins-sg"
  description = "Allow SSH and Jenkins UI"

  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["50.52.115.151/32"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["50.52.115.151/32"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# UPDATED: Fetching the official Ubuntu 24.04 LTS AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical's Owner ID

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_iam_role_policy" "jenkins_ecs_deploy_policy" {
  name = "JenkinsECSDeployPolicy"
  role = aws_iam_role.jenkins_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # These actions require "*" to function properly
        Effect   = "Allow"
        Action   = [
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition"
        ]
        Resource = "*" 
      },
      {
        # This action CAN be restricted to your specific cluster/service
        Effect   = "Allow"
        Action   = [
          "ecs:UpdateService"
        ]
        Resource = [
            "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/recipe-finder-prod-cluster/recipe-finder-prod-service",
            "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster/recipe-finder-prod-cluster"
        ]
      },
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = [
          "arn:aws:iam::045615334997:role/recipe-finder-prod-ecs-task-execution-role", 
          "arn:aws:iam::045615334997:role/recipe-finder-prod-ecs-task-role" 
        ]
      }
    ]
  })
}

resource "aws_instance" "jenkins_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.medium"
  iam_instance_profile   = aws_iam_instance_profile.jenkins_profile.name
  vpc_security_group_ids = [aws_security_group.jenkins_sg.id]

  user_data = <<-EOF
#!/bin/bash
exec > >(tee /var/log/user-data.log) 2>&1
echo "=== Ubuntu Setup Started at $(date) ==="

# Update system
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get upgrade -y

# Install Java 17 (Required for Jenkins)
echo "=== Installing Java ==="
apt-get install openjdk-17-jdk -y

# Install Jenkins
echo "=== Installing Jenkins ==="
apt-get install wget gnupg -y
sudo mkdir -p /usr/share/keyrings
sudo wget -q -O - https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key | sudo gpg --dearmor -o /usr/share/keyrings/jenkins.gpg
echo "deb [signed-by=/usr/share/keyrings/jenkins.gpg] https://pkg.jenkins.io/debian-stable binary/" | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt-get update
sudo apt-get install jenkins -y
sudo systemctl enable jenkins
sudo systemctl start jenkins

# Install Docker
echo "=== Installing Docker ==="
apt-get install docker.io -y
systemctl enable docker
systemctl start docker
usermod -aG docker jenkins
usermod -aG docker ubuntu

# Install Checkov using a Virtual Environment (to avoid OS conflicts)
echo "=== Installing Checkov ==="
apt-get install python3-pip python3-venv -y
python3 -m venv /opt/checkov-env
/opt/checkov-env/bin/pip install --upgrade pip
/opt/checkov-env/bin/pip install checkov
# Create a symlink so 'checkov' works everywhere
ln -s /opt/checkov-env/bin/checkov /usr/local/bin/checkov

# Gitleaks (Secret Scan)
echo "=== Installing Gitleaks ==="
cd /tmp
curl -Lo gitleaks.tar.gz https://github.com/gitleaks/gitleaks/releases/download/v8.18.2/gitleaks_8.18.2_linux_x64.tar.gz
tar -xzf gitleaks.tar.gz
mv gitleaks /usr/local/bin/
rm gitleaks.tar.gz

# Syft & Grype
echo "=== Installing Syft & Grype ==="
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin

# Update and install unzip
sudo apt update
sudo apt install unzip -y
sudo apt install -y jq

# Download the AWS CLI v2 installer
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"

# Unzip and install
unzip awscliv2.zip
sudo ./aws/install

# Verify it works
aws --version
echo "=== Setup Completed Successfully ==="
EOF

  tags = { Name = "Jenkins-Ubuntu-Management-Server" }
}
