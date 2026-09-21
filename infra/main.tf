# Terraform-Root für die quizapp-Multiplayer-Infrastruktur.
#
# Phase 1 stellt die minimale Real-Time-Basis bereit:
#   • DynamoDB-Tabellen für Rooms und WebSocket-Sessions
#   • Lambda-Handler (nodejs20.x) für die drei WS-Routen
#   • API Gateway WebSocket-API mit $connect / $disconnect / $default
#   • Nötige IAM-Rechte für den Handler
#
# Ab Phase 2 kommt in dieselben Ressourcen die eigentliche Reducer-Logik
# und der Room-State wird tatsächlich in DynamoDB gepflegt.
#
# ---- Deployment ----
#   1. AWS-Credentials im Shell-Environment (siehe ../infra/README.md)
#   2. cd infra
#   3. terraform init
#   4. terraform plan  -var="environment=dev"
#   5. terraform apply -var="environment=dev"
#
# ---- Backend ----
#   Standard: lokaler State (terraform.tfstate im infra/-Ordner, ignoriert
#   via .gitignore). Für Team-Nutzung später auf S3 + DynamoDB umziehen —
#   dazu den `backend "s3"`-Block unten aktivieren und einmalig migrieren
#   (`terraform init -migrate-state`).

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # backend "s3" {
  #   bucket         = "quizapp-tfstate"
  #   key            = "infra/terraform.tfstate"
  #   region         = "eu-central-1"
  #   dynamodb_table = "quizapp-tfstate-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

locals {
  # Prefix für alle Ressourcen-Namen: erlaubt parallele Environments (dev/staging/prod)
  # in einem AWS-Account, ohne dass Namen kollidieren.
  name_prefix = "${var.project_name}-${var.environment}"
}
