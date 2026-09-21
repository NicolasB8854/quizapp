# infra — Terraform für die quizapp-Multiplayer-Infrastruktur

Alle AWS-Ressourcen für den Realtime-Backend-Layer:

- **API Gateway WebSocket API** — der Transport-Layer für Player + Master-Screens
- **Lambda (nodejs20.x)** — Reducer-Handler hinter allen WS-Routen
- **DynamoDB** — Rooms, Sessions, Player-Profile
- **IAM + CloudWatch** — Least-privilege-Rollen und Log-Retention

## Voraussetzungen

- Terraform ≥ 1.5
- AWS-CLI-Zugang: entweder `aws sso login` (empfohlen), `AWS_PROFILE`
  gesetzt, oder Access-Keys via `aws configure`
- Node 20 lokal, damit `npm --prefix server run build` das Bundle liefert,
  das Terraform in Lambda verpackt

Region-Default ist **eu-central-1** (Frankfurt); überschreiben via
`-var="aws_region=..."`.

## Erst-Setup

```sh
# 1) Server-Bundle bauen — Terraform packt es sonst leer ein
npm --prefix server install
npm --prefix server run build

# 2) Terraform init: lädt Provider, richtet lokalen State ein
terraform -chdir=infra init

# 3) Plan ansehen (dry run)
terraform -chdir=infra plan -var="environment=dev"

# 4) Anwenden — echte Ressourcen anlegen
terraform -chdir=infra apply -var="environment=dev"
```

Nach `apply` gibt Terraform die wichtigsten Outputs zurück:

- `ws_endpoint` — der `wss://…`-Endpunkt fürs Frontend (`VITE_WS_URL`)
- `rooms_table`, `sessions_table`, `players_table` — DynamoDB-Namen
- `lambda_function_name` — für `aws logs tail`

## Verifikation im Live-System

```sh
# Handler-Logs live mitverfolgen (Phase 1: nur connect/disconnect)
aws logs tail /aws/lambda/quizapp-dev-ws-handler --follow

# Test-Verbindung ohne echten Client
npm install -g wscat
wscat -c "$(terraform -chdir=infra output -raw ws_endpoint)"
# → sollte "connected" ausgeben und offen bleiben; CloudWatch-Log
#   zeigt einen `$connect`-Event.
```

## Environments (dev / staging / prod)

Alle Ressourcen bekommen `${project_name}-${environment}` als Prefix.
Mehrere Umgebungen parallel im selben Account möglich:

```sh
terraform -chdir=infra apply -var="environment=staging"
```

Für saubere Trennung empfiehlt sich später ein Terraform-Workspace pro
Environment (`terraform workspace new staging`) — aktuell reicht die
Variable, weil wir noch nicht in prod deployen.

## Kosten

Für Party-Nutzung praktisch **0 € / Monat** (alles unter Free-Tier):

- API Gateway WebSocket: 1 M Messages / Monat frei
- Lambda: 1 M Requests + 400 k GB-Sekunden frei
- DynamoDB On-Demand: 25 GB + Reads/Writes im Free-Tier
- CloudWatch Logs: kostet einige Cent bei debug-Level; Retention 14 Tage

## Aufräumen

```sh
terraform -chdir=infra destroy -var="environment=dev"
```

Löscht **alle** Ressourcen inklusive DynamoDB-Daten. Mit Bedacht.

## State-Migration auf S3 (später)

Sobald mehrere Personen deployen, State auf S3 mit DynamoDB-Locking
umziehen. Im `main.tf` den `backend "s3"`-Block aktivieren, dann:

```sh
terraform -chdir=infra init -migrate-state
```

Erwartet einen existierenden Bucket `quizapp-tfstate` und eine
DynamoDB-Tabelle `quizapp-tfstate-lock` (einmalige Bootstrap-Arbeit,
außerhalb von diesem Root).
