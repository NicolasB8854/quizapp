# Bündelt den kompilierten Handler-Code (../server/dist) in ein ZIP,
# das Lambda erwartet. `terraform apply` triggert `data.archive_file`
# nur bei Änderung des Source-Ordners — dank source_dir + Hash.
data "archive_file" "ws_handler" {
  type        = "zip"
  source_dir  = "${path.module}/../server/dist"
  output_path = "${path.module}/.build/ws_handler.zip"
}

# CloudWatch-Log-Group explizit anlegen, damit wir die Retention kontrollieren.
# Lambda würde die Group sonst on-the-fly erstellen — dann aber mit
# unlimited retention (teure Log-Ansammlung nach Monaten).
resource "aws_cloudwatch_log_group" "ws_handler" {
  name              = "/aws/lambda/${local.name_prefix}-ws-handler"
  retention_in_days = var.lambda_log_retention_days
}

resource "aws_iam_role" "ws_handler" {
  name = "${local.name_prefix}-ws-handler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

# Basic execution: CloudWatch-Logs schreiben können.
resource "aws_iam_role_policy_attachment" "ws_handler_basic" {
  role       = aws_iam_role.ws_handler.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB-Zugriff (least privilege): der Handler darf nur auf unsere
# drei Tabellen lesen/schreiben, sonst nichts.
resource "aws_iam_role_policy" "ws_handler_ddb" {
  name = "${local.name_prefix}-ws-handler-ddb"
  role = aws_iam_role.ws_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
      ]
      Resource = [
        aws_dynamodb_table.rooms.arn,
        "${aws_dynamodb_table.rooms.arn}/index/*",
        aws_dynamodb_table.sessions.arn,
        "${aws_dynamodb_table.sessions.arn}/index/*",
        aws_dynamodb_table.players.arn,
        "${aws_dynamodb_table.players.arn}/index/*",
      ]
    }]
  })
}

# API-Gateway-Management: der Handler broadcastet später Messages an
# alle Verbindungen im Raum. Dazu braucht er `execute-api:ManageConnections`
# auf der eigenen WebSocket-API.
resource "aws_iam_role_policy" "ws_handler_apigw" {
  name = "${local.name_prefix}-ws-handler-apigw"
  role = aws_iam_role.ws_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["execute-api:ManageConnections"]
      Resource = "${aws_apigatewayv2_api.ws.execution_arn}/*"
    }]
  })
}

resource "aws_lambda_function" "ws_handler" {
  function_name    = "${local.name_prefix}-ws-handler"
  role             = aws_iam_role.ws_handler.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.ws_handler.output_path
  source_code_hash = data.archive_file.ws_handler.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      ROOMS_TABLE    = aws_dynamodb_table.rooms.name
      SESSIONS_TABLE = aws_dynamodb_table.sessions.name
      PLAYERS_TABLE  = aws_dynamodb_table.players.name
      ROOM_TTL_HOURS = tostring(var.room_ttl_hours)
      LOG_LEVEL      = var.environment == "prod" ? "info" : "debug"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.ws_handler,
    aws_iam_role_policy_attachment.ws_handler_basic,
  ]
}

# Erlaubt API Gateway, die Lambda zu invoken. Ein permission-Block pro
# WS-Route, damit die Zuordnung explizit sichtbar ist.
resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.ws.execution_arn}/*/*"
}
