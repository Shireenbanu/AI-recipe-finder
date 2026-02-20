![Threat Modeling (1)](https://github.com/user-attachments/assets/3d68ad6f-08a8-4548-8f17-c13ed29ecf05)

| Threat Actor             | STRIDE Category        | Threat (The Loophole)                                                                             | Mitigation (The Control)                                                                           |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Malicious Extension      | Information Disclosure | A "Dark Mode" extension the user installed reads `userEmail` and `userName` from Local Storage.   | Move PII to **HttpOnly cookies**; use the backend to fetch PII only when needed for display.       |
| Internal Network Sniffer | Information Disclosure | Sniffs plain HTTP traffic between the ALB and ECS Fargate.                                        | **Security Groups:** only allow ingress from the ALB SG; use **TLS between ALB and ECS**.          |
| Log Poisoner             | Tampering              | Injects malicious scripts into ALB logs via HTTP headers to exploit log-analysis tools.           | Sanitize log inputs; use **AWS WAF** to block common injection patterns before they reach the ALB. |
| Compromised ECS Process  | Elevation of Privilege | Attacker uses the ECS IAM role to delete all files in the S3 bucket.                              | **IAM Least Privilege:** restrict role to `s3:PutObject` on specific ARNs only.                    |
| XSS Scraper              | Information Disclosure | A script injected into a "Comments" section sends all Local Storage keys to an attacker’s server. | Use **Content Security Policy (CSP)** to block unauthorized data exfiltration (`connect-src`).     |
| SQL Injector             | Tampering              | Attacker uses a form field to send a `DROP TABLE` command to RDS.                                 | Use **prepared statements** (parameterized queries); use a limited DB user.                        |
| Malicious Patient/User   | Tampering              | Uploads a script masquerading as a lab report to gain RCE (Remote Code Execution) on the server.  | Validate files using **magic bytes** (headers), not extensions; scan for malware.                  |

## 1. Executive Summary

- **Status:** Draft
- **Last Updated:** 2026-02-11
- **Owner:** Shireen Ahmed
- **Architecture:** 3-Tier Web (**ALB → ECS Fargate → RDS/S3**)

## Data Flow Diagram (DFD) — Key Components

| Component   | Role                          | Trust Level |
| ----------- | ----------------------------- | ----------- |
| User        | External entity               | Untrusted   |
| ALB         | Entry point + SSL termination | Boundary    |
| ECS Fargate | App logic + processing        | Trusted     |
| RDS / S3    | Sensitive data storage        | Trusted     |

## Threat Actors

| Actor ID | Name                           | Description                                                                | Access Level  |
| -------- | ------------------------------ | -------------------------------------------------------------------------- | ------------- |
| TA01     | Malicious Extension (PII info) | Browser extension reads PII (userEmail, userName) from Local Storage.      | User Device   |
| TA02     | Internal Network Sniffer       | Sniffs traffic between the ALB and ECS Fargate if HTTP is used internally. | VPC Network   |
| TA03     | Log Poisoner                   | Injects payloads into ALB logs via headers to exploit log analysis tools.  | None          |
| TA04     | Compromised ECS Process        | Attacker gains RCE inside a container and abuses task role permissions.    | Service Role  |
| TA05     | SQL Injector                   | Sends malicious SQL via input fields to tamper with RDS.                   | Standard User |
| TA06     | Lateral Mover                  | Pivots through AWS resources using stolen credentials or weak IAM.         | IAM Role      |
| TA07     | Malicious Patient/User         | Uploads a malicious file disguised as a lab report to trigger RCE.         | Standard User |

Git Leaks:

<img width="1234" height="640" alt="Screenshot 2026-02-12 at 4 08 40 PM" src="https://github.com/user-attachments/assets/b847b8b2-92c0-4508-bf6e-75a704a25c9e" />

<img width="660" height="182" alt="image" src="https://github.com/user-attachments/assets/1a8160ea-a6cd-44f6-848b-2624d4e1d577" />
<<<<<<< Updated upstream



Threat Model for Container Hardening: 
Please checkout the link for detailed explanation.

## 🛡️ Container Hardening Matrix (The 7-Layer Defense)

| Layer | Focus | Risk | Threat | Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **L1** | **Multi-Stage Build** | Build-time residue (compilers, `.git`, secrets) left in image. | **Lateral Movement:** Attackers use leftover tools to compile malware or pivot deeper into the network. | **Build Dirty, Run Clean:** Separate build and runtime stages; only production assets move to the final image. |
| **L2** | **Non-Root Identity** | Containers running as `root` (UID 0) by default. | **Host Escape:** Exploits (e.g., CVE-2024-21626) allow a root process to break out and control the host. | **Ghost Accounts:** Create a system `appuser` with no shell or home directory to enforce a permission "ceiling." |
| **L3** | **Hardened Nginx** | App requires root access to write to system paths like `/var/run`. | **Runtime Tampering:** Attackers overwrite configs or web files to serve malware or redirect traffic. | **User-Owned Paths:** Patch Nginx to use `/tmp` for PIDs/cache and `chown` those paths to the `appuser`. |
| **L4** | **Unprivileged Manager** | Process managers (Supervisord) traditionally running with root "crowns." | **Privilege Escalation:** A hijacked manager grants the attacker "God Mode" over all managed sub-processes. | **Powerless Manager:** Run `supervisord` as `appuser` and stream logs to `stdout` to prevent local data mining. |
| **L5** | **Immutable Filesystem** | Writable runtime layers allow attackers to modify the OS environment. | **Malware Persistence:** Attackers download web shells or scripts that survive as long as the container runs. | **The "DVD" Model:** Enable `readonlyRootFilesystem` and use `tmpfs` mounts with `noexec` to kill execution. |
| **L6** | **Kernel Capabilities** | Granular kernel permissions (Capabilities) active by default. | **Privilege Jumping:** Attackers use `NET_RAW` or `DAC_OVERRIDE` to sniff traffic or bypass file security. | **The Blackout:** Use `drop = ["ALL"]` to zero out `CapEff` and `CapBnd`, stripping all kernel-level privileges. |
| **L7** | **Image Signing** | Unverified images pulled from an untrusted or compromised registry. | **Supply Chain Attack:** An attacker swaps a legitimate image with a "poisoned" version containing a backdoor. | **Notation (CNCF):** Cryptographically sign images in CI/CD and verify signatures before every deployment. |
=======
>>>>>>> Stashed changes
