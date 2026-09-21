# WebSocket-API: eingehende Verbindungen von Player-Handys und Master-View.
#
# `route_selection_expression` legt fest, welches Feld im eingehenden JSON
# den Routing-Key liefert. Wir wählen bewusst `$request.body.action`, damit
# Client-Messages wie `{ "action": "buzz", ... }` in Phase 2 gezielt geroutet
# werden können. In Phase 1 fangen wir alles über die `$default`-Route.
resource "aws_apigatewayv2_api" "ws" {
  name                       = "${local.name_prefix}-ws"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

# Integration = welche Lambda hinter der Route sitzt. Für alle drei Standard-
# Routen dieselbe Handler-Function; das Fan-out passiert intern via routeKey.
resource "aws_apigatewayv2_integration" "ws_handler" {
  api_id                    = aws_apigatewayv2_api.ws.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.ws_handler.invoke_arn
  content_handling_strategy = "CONVERT_TO_TEXT"
  passthrough_behavior      = "WHEN_NO_MATCH"
}

resource "aws_apigatewayv2_route" "connect" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_handler.id}"
}

resource "aws_apigatewayv2_route" "disconnect" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_handler.id}"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.ws_handler.id}"
}

# Auto-Deploy in eine Stage passend zum Environment. Route-Updates
# werden dann bei jedem `terraform apply` sofort scharfgeschaltet.
resource "aws_apigatewayv2_stage" "live" {
  api_id      = aws_apigatewayv2_api.ws.id
  name        = var.environment
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 500
    throttling_rate_limit  = 200
  }
}
