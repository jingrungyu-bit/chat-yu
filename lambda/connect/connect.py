import json
import logging
import os
import re
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

CALLSIGN_RE = re.compile(r"^[a-zA-Z0-9_]{1,20}$")
TABLE_NAME = os.environ["TABLE_NAME"]
DYNAMODB_ENDPOINT = os.environ.get("DYNAMODB_ENDPOINT")

dynamodb = boto3.resource(
    "dynamodb",
    **({"endpoint_url": DYNAMODB_ENDPOINT} if DYNAMODB_ENDPOINT else {}),
)
table = dynamodb.Table(TABLE_NAME)


def _broadcast_user_joined(connection_id: str, callsign: str, domain: str, stage: str) -> None:
    """Fan-out a user_joined system event to all existing connections (best-effort)."""
    endpoint_url = f"https://{domain}/{stage}"
    apigw = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)

    payload = json.dumps({
        "type": "system",
        "event": "user_joined",
        "callsign": callsign,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }).encode()

    # Scan with pagination
    scan_kwargs: dict = {"ProjectionExpression": "connectionId"}
    connections: list = []
    while True:
        resp = table.scan(**scan_kwargs)
        connections.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        scan_kwargs["ExclusiveStartKey"] = last

    for conn in connections:
        cid = conn["connectionId"]
        if cid == connection_id:
            # Don't echo back to the new connection itself
            continue
        try:
            apigw.post_to_connection(ConnectionId=cid, Data=payload)
        except apigw.exceptions.GoneException:
            try:
                table.delete_item(Key={"connectionId": cid})
            except ClientError:
                pass
        except Exception as exc:
            logger.warning("broadcast user_joined failed for %s: %s", cid, exc)


def handler(event: dict, context: object) -> dict:
    req = event.get("requestContext", {})
    connection_id: str = req["connectionId"]

    # Validate callsign from query string
    qs = event.get("queryStringParameters") or {}
    callsign: str | None = qs.get("callsign")
    if not callsign or not CALLSIGN_RE.match(callsign):
        return {"statusCode": 400, "body": "Invalid or missing callsign"}

    # Persist connection
    try:
        table.put_item(Item={
            "connectionId": connection_id,
            "callsign": callsign,
            "connectedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        })
    except ClientError as exc:
        logger.error("DynamoDB PutItem failed: %s", exc)
        return {"statusCode": 500, "body": "Internal server error"}

    # Broadcast join event (best-effort; never block the handshake)
    domain = req.get("domainName", "")
    stage = req.get("stage", "prod")
    if domain and not DYNAMODB_ENDPOINT:
        try:
            _broadcast_user_joined(connection_id, callsign, domain, stage)
        except Exception as exc:
            logger.warning("user_joined broadcast error: %s", exc)

    return {"statusCode": 200, "body": "Connected"}
