#!/bin/bash
set -e

# 1. Update system and install base dependencies immediately
# In AL2023, we use 'dnf' (though 'yum' still works as an alias)
dnf update -y
dnf install -y docker git wget unzip java-17-amazon-corretto-headless

# 2. Install CloudWatch Agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

# 3. Create CloudWatch Configuration File
# Using 'root' ensures it can read /var/log/messages and jenkins.log
cat <<EOF > /opt/aws/amazon-cloudwatch-agent/bin/config.json
{
  "agent": {
    "run_as_user": "root"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/messages",
            "log_group_name": "/aws/ec2/ai-recipe-recommender/jenkins",
            "log_stream_name": "{instance_id}/system"
          },
          {
            "file_path": "/var/log/jenkins/jenkins.log",
            "log_group_name": "/aws/ec2/ai-recipe-recommender/jenkins",
            "log_stream_name": "{instance_id}/jenkins-internal"
          }
        ]
      }
    }
  }
}
EOF

# 4. Start the CloudWatch Agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
-a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/bin/config.json -s

# 5. Setup Jenkins Repository
wget -O /etc/yum.repos.d/jenkins.repo https://pkg.jenkins.io/redhat-stable/jenkins.repo
rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io-2023.key

# 6. Install Jenkins
dnf install -y jenkins

# Install the rsyslog service
sudo dnf install rsyslog -y

# Start it and ensure it runs on boot
sudo systemctl enable --now rsyslog

# Verify the file now exists
ls -l /var/log/messages
# 7. Start and Enable Services
systemctl enable --now jenkins
systemctl enable --now docker

# 8. Permissions: Allow Jenkins to use Docker
usermod -aG docker jenkins
systemctl restart jenkins

# 9. Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

echo "Jenkins & CloudWatch Agent installation complete!"