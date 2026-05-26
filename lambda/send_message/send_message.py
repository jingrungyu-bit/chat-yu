import json
import logging
import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ["TABLE_NAME"]
DYNAMODB_ENDPOINT = os.environ.get("DYNAMODB_ENDPOINT")

dynamodb = boto3.resource(
    "dynamodb",
    **({"endpoint_url": DYNAMODB_ENDPOINT} if DYNAMODB_ENDPOINT else {}),
)
table = dynamodb.Table(TABLE_NAME)

MAX_TEXT_LENGTH = 1000


def _get_all_connections() -> list[dict]:
    """Scan the connections table with pagination, returning all items."""
    scan_kwargs: dict = {"ProjectionExpression": "connectionId"}
    connections: list = []
    while True:
        resp = table.scan(**scan_kwargs)
        connections.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        scan_kwargs["ExclusiveStartKey"] = last
    return connections


def handler(event: dict, context: object) -> dict:
    req = event.get("requestContext", {})
    sender_id: str = req["connectionId"]
    domain: str = req.get("domainName", "")
    stage: str = req.get("stage", "prod")

    # Parse body
    try:
        body = json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return {"statusCode": 400, "body": "Invalid JSON body"}

    text = body.get("text")
    if not text or not isinstance(text, str) or not text.strip():
        return {"statusCode": 400, "body": "Missing or invalid text"}
    if len(text) > MAX_TEXT_LENGTH:
        return {"statusCode": 400, "body": "Message too long"}

    # Retrieve sender's callsign (prevents spoofing)
    try:
        resp = table.get_item(Key={"connectionId": sender_id})
        sender = resp.get("Item")
    except ClientError as exc:
        logger.error("GetItem failed: %s", exc)
        return {"statusCode": 500, "body": "Internal server error"}

    if not sender:
        return {"statusCode": 400, "body": "Unknown sender"}

    callsign: str = sender["callsign"]

    # Build broadcast payload
    payload = json.dumps({
        "type": "message",
        "callsign": callsign,
        "text": text,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }).encode()

    # Fetch all connections
    try:
        connections = _get_all_connections()
    except ClientError as exc:
        logger.error("DynamoDB scan failed: %s", exc)
        return {"statusCode": 500, "body": "Internal server error"}

    # Fan-out via PostToConnection
    endpoint_url = f"https://{domain}/{stage}"
    apigw = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)

    for conn in connections:
        cid = conn["connectionId"]
        try:
            apigw.post_to_connection(ConnectionId=cid, Data=payload)
        except apigw.exceptions.GoneException:
            # Stale connection — clean up silently
            try:
                table.delete_item(Key={"connectionId": cid})
            except ClientError:
                pass
        except Exception as exc:
            logger.warning("PostToConnection failed for %s: %s", cid, exc)

    return {"statusCode": 200, "body": "Message sent"}
