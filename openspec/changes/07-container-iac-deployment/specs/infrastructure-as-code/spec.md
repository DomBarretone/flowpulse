# Spec Delta: infrastructure-as-code

## Purpose

Defines requirements for declarative cloud infrastructure as code using Terraform, partial S3 remote state with native locking, modular AWS resources, real HTTPS load balancing, zero-persistence secrets with canary verification, and configurable scaling capabilities.

## ADDED Requirements

### Requirement: Terraform Modular Architecture and Version Pinning
The repository SHALL define cloud infrastructure within `infra/terraform/` using modular components for networking, container registry, container compute (ECS Fargate), load balancing with real HTTPS, and secrets management. The configuration SHALL specify `required_version >= 1.11.0` and pin provider versions with a bounded range (`hashicorp/aws >= 5.86.0, < 6.0.0`). The repository SHALL track `.terraform.lock.hcl` in Git. All input variables SHALL declare explicit types, with sensitive parameters marked `sensitive = true` and `ephemeral = true`.

#### Scenario: Terraform configuration formats and validates cleanly
- **WHEN** `terraform fmt -check -recursive` and `terraform validate` are executed in `infra/terraform/environments/production`
- **THEN** both commands exit with code 0 and report no formatting errors or syntax violations

#### Scenario: Production environment defines typed variables and outputs
- **WHEN** the production Terraform configuration is inspected
- **THEN** all variables have explicit HCL types, output values expose the Application Load Balancer DNS name, and example variables are provided via `terraform.tfvars.example` without secrets

### Requirement: Remote State Management with Partial S3 Backend and Native Locking
Terraform state SHALL be stored in an external AWS S3 bucket with server-side encryption and object versioning enabled, with concurrency locking managed natively via `use_lockfile = true`. The production configuration SHALL declare an empty partial backend (`backend "s3" {}`) with bucket name, key, region, and lockfile settings supplied dynamically via `-backend-config` arguments during initialization. A dedicated bootstrap configuration (`infra/terraform/bootstrap/`) SHALL define the S3 state storage independently without DynamoDB lock tables, using temporary local state protected by `.gitignore`.

#### Scenario: Remote state configuration utilizes partial backend and native S3 locking
- **WHEN** `infra/terraform/environments/production/backend.tf` is evaluated
- **THEN** it declares a partial `backend "s3" {}` block without variable interpolation, and initialization succeeds when supplied with `-backend-config` parameters including `use_lockfile = true`

#### Scenario: Git ignore protects state and local provider cache
- **WHEN** `git status --ignored` is evaluated on a workspace containing local terraform artifacts
- **THEN** `.terraform/`, `*.tfstate`, and `*.tfstate.backup` are listed as ignored and never staged for commit

### Requirement: Zero Secret Persistence in Terraform State with Canary Probe
Sensitive production secrets (`database_url`, `clerk_secret_key`, and `openrouter_api_key`) SHALL be managed via AWS Systems Manager Parameter Store using write-only parameter attributes (`value_wo` and `value_wo_version`) supported by AWS provider `>= 5.86.0, < 6.0.0` and Terraform CLI `>= 1.11` ephemeral variables. The absence of secret values from state and plan outputs SHALL be validated using a synthetic canary secret (`FLOWPULSE_TERRAFORM_SECRET_CANARY_DO_NOT_PERSIST`), outputting strictly PASS or FAIL without logging real credentials.

#### Scenario: Synthetic canary secret probe confirms absence from plan and state
- **WHEN** a Terraform plan and ephemeral apply probe executes using the synthetic canary value `FLOWPULSE_TERRAFORM_SECRET_CANARY_DO_NOT_PERSIST`
- **THEN** the canary string is not present in `terraform show -json` or the resulting state, and the probe logs strictly a PASS result

#### Scenario: Parameter resources utilize write-only attributes
- **WHEN** SSM parameter resources are declared in Terraform
- **THEN** they specify `value_wo` rather than `value` and reference ephemeral sensitive variables

### Requirement: Production HTTPS Load Balancing and Networking
The Terraform configuration SHALL provision an Amazon ECS cluster on AWS Fargate, AWS ECR repositories, and an Application Load Balancer (ALB) terminating HTTPS on port 443 with an AWS Certificate Manager (ACM) certificate. The ALB SHALL maintain a port 80 listener performing a permanent HTTP 301 redirect to HTTPS. Networking SHALL span 2 Availability Zones without NAT Gateways, using public task subnets with security groups restricting inbound container traffic strictly to the ALB.

#### Scenario: ALB enforces HTTPS listener and HTTP redirect
- **WHEN** the ALB listeners are evaluated in the Terraform configuration
- **THEN** port 443 terminates TLS with an ACM certificate and port 80 executes a default HTTP_301 redirect to port 443

#### Scenario: Container security groups enforce ALB-only ingress
- **WHEN** networking security group rules are evaluated in the Terraform plan
- **THEN** container task security groups permit inbound HTTP traffic exclusively from the ALB security group

### Requirement: Configurable High Availability and Stateless Scalability
The container services SHALL operate statelessly with configurable replica scaling via variable `desired_count` (defaulting to 2 for multi-AZ high availability, reducible to 1 for academic cost control). The ECS service scheduler SHALL automatically replace unhealthy containers based on ALB target group health checks.

#### Scenario: Configurable task count per environment needs
- **WHEN** `desired_count` is set to 2 in production or 1 in cost-control mode
- **THEN** ECS provisions the exact declared number of task replicas across available subnets

#### Scenario: Automated replacement of failing containers
- **WHEN** a container instance fails health check evaluations repeatedly
- **THEN** the ECS service scheduler automatically terminates the unhealthy task and provisions a healthy replacement
