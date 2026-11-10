terraform {
  required_version = ">= 1.5.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "project" {
  type    = string
  default = "cbt-platform"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

provider "aws" {
  region = var.region
}

# Skeleton ready for VPC, EKS, RDS MySQL, S3.
# Extend modules per environment without changing application contracts.

output "notes" {
  value = "Terraform skeleton for ${var.project} in ${var.region}. Wire VPC/EKS/RDS/S3 modules for production."
}
