# HTTP-API für den Fragen-Editor (Review-Page im Frontend).
#
# Getrennt vom WebSocket-API in `apigateway.tf`, weil die Semantik
# unterschiedlich ist:
#   - WebSocket: stateful Sessions, State-Broadcast an Room-Teilnehmer
#   - HTTP:      klassische CRUD-Endpoints, Frontend fetched On-Demand
#
# Die Lambda-Function ist dieselbe (`aws_lambda_function.ws_handler`) —
# der Handler unterscheidet intern via Event-Shape (routeKey für WS,
# requestContext.http für REST).
#
# CORS ist offen (`allow_origins = ["*"]`) für den Dev-Prototyp. Für
# einen echten Prod-Deploy sollte hier die Amplify-Hosting-Domain
# whitelistet werden.

resource "aws_apigatewayv2_api" "http" {
  name          = "${local.name_prefix}-http"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_integration" "http_handler" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.ws_handler.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Routes: /questions und /questions/{id} × HTTP-Methoden.
# ANY könnte alle Methods gleichzeitig routen, aber explizite Routes
# helfen später bei Route-spezifischen Restrictions.
resource "aws_apigatewayv2_route" "http_list_questions" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /questions"
  target    = "integrations/${aws_apigatewayv2_integration.http_handler.id}"
}

resource "aws_apigatewayv2_route" "http_get_question" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /questions/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.http_handler.id}"
}

resource "aws_apigatewayv2_route" "http_create_question" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /questions"
  target    = "integrations/${aws_apigatewayv2_integration.http_handler.id}"
}

resource "aws_apigatewayv2_route" "http_update_question" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "PUT /questions/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.http_handler.id}"
}

resource "aws_apigatewayv2_route" "http_delete_question" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "DELETE /questions/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.http_handler.id}"
}

resource "aws_apigatewayv2_stage" "http_live" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 500
    throttling_rate_limit  = 200
  }
}

# Lambda-Permission: erlaubt die HTTP-API, die Function zu invoken.
resource "aws_lambda_permission" "http_apigw_invoke" {
  statement_id  = "AllowHTTPAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
