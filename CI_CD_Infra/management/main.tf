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

resource "aws_iam_role_policy" "jenkins_ecs_deploy_policy" {
  name = "JenkinsECSDeployPolicy"
  role = aws_iam_role.jenkins_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService"
        ]
        Resource = [
          "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/recipe-finder-prod-cluster/recipe-finder-prod-service",
          "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster/recipe-finder-prod-cluster"
        ]
      },
      {
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/recipe-finder-prod-ecs-task-execution-role",
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/recipe-finder-prod-ecs-task-role"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "signer:SignPayload",
          "signer:PutSigningProfile",
          "signer:GetSigningProfile",
          "signer:StartSigningJob",
          "signer:GetSigningJob",
          "signer:ListSigningJobs",
          "signer:AddProfilePermission",
          "signer:GetRevocationStatus"
        ]
        Resource = "*"
      }
    ]
  })
}

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

resource "aws_instance" "jenkins_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.medium"
  iam_instance_profile   = aws_iam_instance_profile.jenkins_profile.name
  vpc_security_group_ids = [aws_security_group.jenkins_sg.id]

  root_block_device {
    volume_size           = 20
    volume_type           = "gp3"
    delete_on_termination = true
  }

  user_data = <<-EOF
#!/bin/bash
exec > >(tee /var/log/user-data.log) 2>&1
echo "=== Ubuntu Setup Started at $(date) ==="

# Update system
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get upgrade -y

# Update SSM Agent to latest version to fix Standard_Stream plugin error
echo "=== Updating SSM Agent ==="
snap refresh amazon-ssm-agent
systemctl restart snap.amazon-ssm-agent.amazon-ssm-agent.service
# Wait for SSM agent to be fully running before continuing
sleep 10
snap info amazon-ssm-agent | grep installed

# Install Java 17 (Required for Jenkins)
echo "=== Installing Java ==="
apt-get install openjdk-17-jdk -y

# Install Jenkins
echo "=== Installing Jenkins ==="
apt-get install wget gnupg -y
mkdir -p /usr/share/keyrings
wget -q -O - https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key | gpg --dearmor -o /usr/share/keyrings/jenkins.gpg
echo "deb [signed-by=/usr/share/keyrings/jenkins.gpg] https://pkg.jenkins.io/debian-stable binary/" | tee /etc/apt/sources.list.d/jenkins.list > /dev/null
apt-get update
apt-get install jenkins -y
systemctl enable jenkins
systemctl start jenkins

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

# Install utilities
apt-get update
apt-get install unzip jq -y

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
aws --version

# Install Notation for image signing
echo "=== Installing Notation ==="
NOTATION_VERSION=$(curl -s https://api.github.com/repos/notaryproject/notation/releases/latest | grep '"tag_name"' | cut -d'"' -f4 | tr -d 'v')
curl -Lo notation.tar.gz "https://github.com/notaryproject/notation/releases/download/v$${NOTATION_VERSION}/notation_$${NOTATION_VERSION}_linux_amd64.tar.gz"
file notation.tar.gz
tar -xzf notation.tar.gz
mv notation /usr/local/bin/
notation version

# Install Notation AWS Signer plugin
echo "=== Installing Notation AWS Signer Plugin ==="
curl -Lo /tmp/notation-aws-signer-plugin.zip \
  "https://d2hvyiie56hcat.cloudfront.net/linux/amd64/plugin/latest/notation-aws-signer-plugin.zip"
CHECKSUM=$(sha256sum /tmp/notation-aws-signer-plugin.zip | cut -d' ' -f1)
PLUGIN_DIR=/home/ubuntu/.config/notation/plugins/com.amazonaws.signer.notation.plugin
mkdir -p $PLUGIN_DIR
unzip /tmp/notation-aws-signer-plugin.zip -d $PLUGIN_DIR
chmod +x $PLUGIN_DIR/notation-com.amazonaws.signer.notation.plugin
chown -R ubuntu:ubuntu /home/ubuntu/.config
su ubuntu -c "notation plugin list"

curl -Lo /tmp/aws-signer-root.pem \
  "https://d2hvyiie56hcat.cloudfront.net/aws-signer-notation-root-ca.pem"
notation cert add \
  --type signingAuthority \
  --store aws-signer-ts \
  /tmp/aws-signer-root.pem
notation cert list
rm /tmp/aws-signer-root.pem

echo "=== Setup Completed Successfully ==="
EOF

  tags = { Name = "Jenkins-Ubuntu-Management-Server" }
}
