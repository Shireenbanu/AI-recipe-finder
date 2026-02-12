terraform {
  backend "s3" {
    bucket         = "ci-cd-terraform-state-2026" 
    key            = "bootstrap/terraform.tfstate"
    region         = "us-west-2"
    use_lockfile   = true
    encrypt        = true
  }
}