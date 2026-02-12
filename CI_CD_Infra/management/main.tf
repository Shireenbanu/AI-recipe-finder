provider "aws" {
  region = "us-west-2"
}


resource "aws_iam_role" "jenkins_role" {
  name = "jenkins-management-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

# This profile is what we actually "attach" to the EC2
resource "aws_iam_instance_profile" "jenkins_profile" {
  name = "jenkins-instance-profile"
  role = aws_iam_role.jenkins_role.name
}
# Attach the managed policy for SSM to your existing Jenkins Role
resource "aws_iam_role_policy_attachment" "jenkins_ssm" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  role       = aws_iam_role.jenkins_role.name
}

resource "aws_security_group" "jenkins_sg" {
  name        = "jenkins-sg"
  description = "Allow SSH and Jenkins UI"

  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["50.52.115.151/32"] # IMPORTANT: Replace with your actual IP
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["50.52.115.151/32"] # Lock SSH to only you
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "jenkins_server" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t3.medium"
  iam_instance_profile   = aws_iam_instance_profile.jenkins_profile.name
  vpc_security_group_ids = [aws_security_group.jenkins_sg.id]
  
  user_data = <<-EOF
     #!/bin/bash
  exec > >(tee /var/log/user-data.log) 2>&1
  echo "=== User Data Script Started at $(date) ==="
  
  # Update system
  sudo dnf update -y
  
  # Install Java 17
  echo "=== Installing Java ==="
  sudo dnf install java-17-amazon-corretto -y
  java -version
  
  # Install Jenkins
  echo "=== Installing Jenkins ==="
  sudo dnf install fontconfig -y
  
  # Add Jenkins repository properly
  sudo dnf install -y dnf-plugins-core
  sudo dnf config-manager --add-repo https://pkg.jenkins.io/redhat-stable/jenkins.repo
  sudo rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io-2023.key
  
  # Install Jenkins from repository
  sudo dnf install jenkins -y
  
  # Start Jenkins
  sudo systemctl daemon-reload
  sudo systemctl enable jenkins
  sudo systemctl start jenkins   

  # Wait for Jenkins to start
  sleep 20

  # 3. Install Docker
  echo "=== Installing Docker ==="
  sudo dnf install docker -y
  sudo systemctl enable docker
  sudo systemctl start docker
  sudo usermod -aG docker jenkins
  sudo usermod -aG docker ec2-user
  
  echo "=== Installing Security Tools ==="

  # Python3 and pip
  sudo dnf install python3-pip -y

  # Checkov (IaC Scan) - install as user
  pip3 install --user checkov

  # Gitleaks (Secret Scan)
  echo "=== Installing Gitleaks ==="
  sudo dnf install git -y
  cd /tmp
  curl -Lo gitleaks.tar.gz https://github.com/gitleaks/gitleaks/releases/download/v8.18.2/gitleaks_8.18.2_linux_x64.tar.gz
  tar -xzf gitleaks.tar.gz
  sudo mv gitleaks /usr/local/bin/
  sudo chmod +x /usr/local/bin/gitleaks
  rm gitleaks.tar.gz
  cd -
   # Syft (SBOM Generation)
  echo "=== Installing Syft ==="
  curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sudo sh -s -- -b /usr/local/bin

    # Grype (Vulnerability Scan)
  echo "=== Installing Grype ==="
  curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sudo sh -s -- -b /usr/local/bin

    echo "=== User Data Script Completed at $(date) ==="
    echo "SUCCESS" > /tmp/user-data-complete
  EOF
  
  tags = { Name = "Jenkins-Management-Server" }
}