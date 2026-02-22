# Secure CI/CD: AI Recipe Finder (DevSecOps Pipeline)
This project demonstrates an end-to-end DevSecOps pipeline built in Jenkins, applying a Security-First philosophy at every stage of the software delivery lifecycle. Rather than treating security as a post-deployment concern, each phase enforces hardened standards before code can progress — ensuring that every container image deployed to AWS ECS has been statically analyzed, vulnerability-scanned, and cryptographically signed.

## Phase 1: Local Development (The Inner Loop)
ESLint catches code quality issues and common security anti-patterns (unsafe eval(), insecure regex) before anything is committed.
Pre-commit hooks handle the basics — trailing whitespace, formatting, and linting — so bad code never reaches the remote repository in the first place.

## Phase 2:Gitleaks (Secret Scanning)
Scans the entire Git history for accidentally committed credentials: AWS keys, API tokens, private secrets.
When I first ran this, it caught two things:

AWS Access Keys — I had committed the keys I was using locally to upload lab reports to S3. Fixed. In production, the app uses an EC2 instance role scoped only to upload and list user files.

Cognito Client ID — This is a false positive. Cognito client IDs are intentionally public per AWS docs; they're required to initiate the auth flow.

<img width="2034" height="1302" alt="image" src="https://github.com/user-attachments/assets/97a09d75-1d3a-4c9a-a2ab-498ede428ef9" />

To suppress the false positive without weakening the scan, I added a custom .gitleaks.toml allowlist


```
[extend]
useDefault = true

[allowlist]
description = "Allow Cognito Public IDs"
regexes = [
    'us-west-2_8hJ9rdYYz',
    '424rre660gcrdf0mjh48ossbf0'     
]

```

## Phase 3: Checkov (IaC Scannning)
Scans Terraform and CloudFormation templates for misconfigured cloud resources — unencrypted S3 buckets, overly permissive IAM policies, publicly exposed databases, etc

First run: 56 failed checks. Took about three days to work through them all. The final run passes 345 tests (200 Terraform, 145 Docker) with 14 intentionally skipped and documented.

Some of the more interesting fixes:
1. CloudWatch Logs — All log groups now encrypted with customer-managed KMS keys, minimum 1-year retention.
2. S3 Buckets — Customer-managed KMS encryption, versioning enabled, all public access blocked by default. I skipped cross-region replication and self-logging since these buckets only hold ALB access logs.
3. IAM Policies — I had a bunch of `Resource: *` wildcards from when I was moving fast. Checkov flagged all of them and I restructured every policy to reference specific resource ARNs.
4. Secrets Manager — I was passing a Google API key as a plain environment variable. Migrated it to Secrets Manager with customer-managed KMS encryption. Skipped automatic 30-day key rotation — it would require a Lambda to re-authenticate downstream services, which is overkill for this project.
5. DNSSec — Enables DNS record signing to protect against cache poisoning if upstream DNS infrastructure is compromised. Also required encrypted DNS query logging in us-east-1.
6. ALB — HTTP/2 enforced, DNS query logging enabled, WAF attached with OWASP Top 10 aws managed rules.
7. Security Groups & Subnets — All security groups now have descriptions (Checkov enforces this). Public subnets set to `map_public_ip_on_launch = false`.

  
<img width="2012" height="534" alt="image" src="https://github.com/user-attachments/assets/a6362a3d-1209-45db-95e0-e0222799646a" />


## Phase 4: Syft (SBOM Generation)
Generates a sbom.json in CycloneDX format — a full inventory of every dependency in the application, including version and license. This feeds directly into the next phase and gives you a point-in-time record of exactly what's in each build.

<img width="1588" height="622" alt="image" src="https://github.com/user-attachments/assets/def30146-6d4a-479d-a903-baf19721643e" />


## Phase 5: Grype (Dependency CVE Scan)
Cross-references sbom.json against the National Vulnerability Database. Any Critical CVE breaks the pipeline immediately.
`npm audit fix --force` works sometimes, but not always — it can introduce breaking changes. For a few packages I just swapped them out for alternatives that provide the same functionality without the CVEs.


## Phase 6: Container Build + OS-Layer Scan
After the image is built, Grype runs a second scan against the entire container filesystem — including the base OS layers (Alpine/Ubuntu). This catches vulnerabilities in system packages that would never show up in package.json or the SBOM.
Thankfully I did not find anything malicious.

## Phase 7: Image Signing + Deploy to ECR
How it works:

AWS Signer signing profile is created and referenced by Notation
Notation signs the image digest using the signing profile
Both the image and its detached signature are pushed to ECR
The signature can be verified before deployment to confirm the image hasn't been tampered with

Deployment is handled by a Bash script in the Jenkins pipeline that calls the AWS CLI to update the ECS service.


### 🛠️ Tools at a Glance

| Phase | Tool | What it does |
| :--- | :--- | :--- |
| **Local** | `ESLint` + `Pre-commit` | Code quality, early error prevention |
| **Source** | `Gitleaks` | Credential and secret leak detection |
| **Infra** | `Checkov` | IaC misconfiguration scanning |
| **Dependencies** | `Syft` | SBOM generation (CycloneDX) |
| **Dependencies** | `Grype` | CVE scan against NVD |
| **Container** | `Grype` | OS-layer vulnerability scan |
| **Registry** | `Notation` + `AWS Signer` | Cryptographic image signing |
| **Deploy** | `Jenkins` + `AWS CLI` | Automated ECS service update |
