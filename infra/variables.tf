variable "aws_region" {
  description = "AWS-Region für alle Ressourcen. Frankfurt als DSGVO-freundlicher Default."
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Namensbestandteil für alle Ressourcen. Kleinbuchstaben, keine Sonderzeichen."
  type        = string
  default     = "quizapp"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.project_name))
    error_message = "project_name muss lowercase, 2-21 Zeichen, nur a-z 0-9 - enthalten."
  }
}

variable "environment" {
  description = "Environment-Label (dev, staging, prod). Fließt in alle Ressourcen-Namen ein."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment muss dev, staging oder prod sein."
  }
}

variable "lambda_log_retention_days" {
  description = "Wie lange werden CloudWatch-Logs der WS-Lambda vorgehalten."
  type        = number
  default     = 14
}

variable "room_ttl_hours" {
  description = "TTL für Room-Einträge in DynamoDB. Rooms räumen sich nach dieser Zeit automatisch weg."
  type        = number
  default     = 24
}
