# Rooms-Tabelle: hält pro Raum den Snapshot des Reducer-States.
#
# Zugriffs-Muster in Phase 2:
#   • Get by roomCode (Reducer läd den State)
#   • Put by roomCode  (nach jeder Action)
#
# Pay-per-request statt Provisioned Capacity — für Party-Traffic ist der
# Overhead vernachlässigbar und wir zahlen tatsächlich nur pro Request.
resource "aws_dynamodb_table" "rooms" {
  name         = "${local.name_prefix}-rooms"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "roomCode"

  attribute {
    name = "roomCode"
    type = "S"
  }

  # Auto-Cleanup: Räume verschwinden nach `room_ttl_hours`, indem wir
  # `expiresAt` (Unix-Sekunden) beim Schreiben setzen.
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  # Point-in-Time-Recovery erst für prod, hier lokaler Verlust ok.
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  server_side_encryption {
    enabled = true
  }
}

# Sessions-Tabelle: eine Row pro aktiver WebSocket-Verbindung.
#
# Zugriffs-Muster in Phase 2:
#   • Put by connectionId          (bei $connect)
#   • Delete by connectionId       (bei $disconnect)
#   • Query by roomCode via GSI   (Broadcast: welche Verbindungen sind im Raum?)
resource "aws_dynamodb_table" "sessions" {
  name         = "${local.name_prefix}-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  attribute {
    name = "roomCode"
    type = "S"
  }

  # GSI, damit wir bei einem Broadcast alle Verbindungen eines Raums finden.
  # Sparse Index: nur Sessions mit roomCode auftauchen (bei $connect ohne
  # Room noch nicht indiziert).
  global_secondary_index {
    name            = "RoomIndex"
    hash_key        = "roomCode"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }
}

# Player-Library-Tabelle (Session AB): persistente Player-Profile über
# Sessions hinweg. Analog zum bisherigen localStorage-Ansatz, aber
# cross-device wiederverwendbar (z. B. via Player-Token beim Join).
#
# Zugriffs-Muster:
#   • Get by playerId  (Wiedererkennung beim Reconnect)
#   • Put by playerId  (Update Name / Avatar / Interessen)
resource "aws_dynamodb_table" "players" {
  name         = "${local.name_prefix}-players"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "playerId"

  attribute {
    name = "playerId"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  server_side_encryption {
    enabled = true
  }
}
