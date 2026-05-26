# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Anonymous WebSocket Chat** — a serverless, single-channel, anonymous real-time chat room. No authentication, no message persistence. Users pick a callsign and chat in a single global channel.

The repository is currently in the **design/implementation phase**: all spec documents are written; no code has been implemented yet.

## Repository Structure

```
chat-yu/
├── documents/              # Design and specification documents (source of truth)
│   ├── 01-system-architecture.md
│   ├── 02-api-specification.md
│   ├── 03-aws-configuration.md
│   ├── 04-lambda-connect-spec.md
│   ├── 05-lambda-disconnect-spec.md
│   ├── 06-lambda-send-message-spec.md
│   └── 07-frontend-design.md
├── web_ui/                 # UI design file (Pencil format)
├── lambda/                 # (to be created) Python 3.12 Lambda functions
│   ├── connect/connect.py
│   ├── disconnect/disconnect.py
│   └── send_message/send_message.py
├── webui/                  # (to be created) React + Vite + TypeScript frontend
└── template.yaml           # (to be created) AWS SAM template
```

## Architecture

```
Browser (React) ──WebSocket──▶ API Gateway (WebSocket API)
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                  ▼
              connect.py       disconnect.py      send_message.py
                    │                 │                  │
                    └─────────────────┴──────────────────┘
                                      │
                               DynamoDB: Connections
                               (connectionId PK, callsign, connectedAt)
```

**Route selection:** API Gateway routes on `$request.body.action`. Three routes: `$connect`, `$disconnect`, `sendMessage`.

**Key design decisions:**
- Callsign stored in DynamoDB on connect; retrieved server-side for each message (prevents spoofing)
- No message history stored — ephemeral delivery only
- `send_message` broadcasts to all connections via `PostToConnection`; on `GoneException` (410), deletes the stale connection

## Backend Commands (SAM / AWS)

```bash
# Verify tooling
aws sts get-caller-identity
sam --version

# Build and deploy
sam validate --template template.yaml
sam build
sam deploy --no-confirm-changeset   # after initial guided deploy

# First-time deploy (interactive — human must run this)
sam deploy --guided   # stack name: anonymous-chat, region: us-west-2

# Get deployed WebSocket endpoint
aws cloudformation describe-stacks \
  --stack-name anonymous-chat \
  --query "Stacks[0].Outputs[?OutputKey=='WebSocketUrl'].OutputValue" \
  --output text

# View logs
sam logs -n ConnectFunction --stack-name anonymous-chat --tail
sam logs -n SendMessageFunction --stack-name anonymous-chat --tail

# Check connections table
aws dynamodb scan --table-name ChatConnections

# Teardown
sam delete --stack-name anonymous-chat --no-prompts
```

### Local Lambda Testing (SAM Local + DynamoDB Local)

```bash
# Start local DynamoDB
docker run -p 8000:8000 amazon/dynamodb-local

# Create local table
aws dynamodb create-table \
  --table-name ChatConnections \
  --attribute-definitions AttributeName=connectionId,AttributeType=S \
  --key-schema AttributeName=connectionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000

# Invoke a Lambda locally with an event file
sam local invoke ConnectFunction -e events/connect_valid.json
sam local invoke DisconnectFunction -e events/disconnect_valid.json
sam local invoke SendMessageFunction -e events/send_valid.json
```

Lambda code should check for `DYNAMODB_ENDPOINT` env var and use `http://host.docker.internal:8000` when present for local development.

## Frontend Commands

```bash
cd webui
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # output to webui/dist/
```

**Environment variable** — create `webui/.env.local`:
```
VITE_WS_ENDPOINT=wss://{api-id}.execute-api.{region}.amazonaws.com/prod
```

WebSocket endpoint falls back to a default if `VITE_WS_ENDPOINT` is not set.

**Vite config must set** `base: '/ai_course_2/'` for GitHub Pages routing.

## Lambda Implementation Notes

- `TABLE_NAME` env var is injected by SAM — never hardcode the table name
- `boto3.client("apigatewaymanagementapi", endpoint_url=...)` must be created per-invocation (endpoint is runtime-only from `event.requestContext`)
- `DynamoDB.scan` must handle pagination via `LastEvaluatedKey`
- `GoneException` on `PostToConnection` → delete the stale connection and continue; never fail the broadcast loop for one bad connection
- `$connect` must return 200 or API Gateway rejects the WebSocket handshake
- `$disconnect` response is informational — connection is already closed

## Callsign Validation

Applied in both Lambda (`$connect`) and the frontend (client-side):
- Regex: `^[a-zA-Z0-9_]{1,20}$`
- Max 20 characters, alphanumeric and underscores only

## AWS Resource Names

| Resource | Name |
|----------|------|
| CloudFormation stack | `anonymous-chat` |
| DynamoDB table | `ChatConnections` |
| Lambda: connect | `chat-connect` |
| Lambda: disconnect | `chat-disconnect` |
| Lambda: send message | `chat-send-message` |
| API Gateway | `AnonymousChatWebSocketApi` |
