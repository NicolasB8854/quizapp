output "ws_endpoint" {
  description = "WebSocket-URL, gegen die das Frontend verbindet (VITE_WS_URL)."
  value       = "${aws_apigatewayv2_api.ws.api_endpoint}/${aws_apigatewayv2_stage.live.name}"
}

output "ws_management_endpoint" {
  description = "HTTPS-Endpunkt der API-Management-API — vom Lambda-Handler für Broadcasts genutzt."
  value       = replace(aws_apigatewayv2_stage.live.invoke_url, "wss://", "https://")
}

output "rooms_table" {
  description = "DynamoDB-Tabelle für Room-Snapshots."
  value       = aws_dynamodb_table.rooms.name
}

output "sessions_table" {
  description = "DynamoDB-Tabelle für WebSocket-Sessions."
  value       = aws_dynamodb_table.sessions.name
}

output "players_table" {
  description = "DynamoDB-Tabelle für persistente Player-Profile."
  value       = aws_dynamodb_table.players.name
}

output "questions_table" {
  description = "DynamoDB-Tabelle mit dem Fragen-Katalog (Server lädt beim Cold-Start)."
  value       = aws_dynamodb_table.questions.name
}

output "lambda_function_name" {
  description = "Name der WS-Handler-Lambda (nützlich für `aws logs tail`)."
  value       = aws_lambda_function.ws_handler.function_name
}
