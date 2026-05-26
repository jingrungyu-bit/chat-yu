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


def _broadcast_user_left(callsign: str, domain: str, stage: str) -> None:
    """Fan-out a user_left system event to all remaining connections (best-effort)."""
    endpoint_url = f"https://{domain}/{stage}"
    apigw = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)

    payload = json.dumps({
        "type": "system",
        "event": "user_left",
        "callsign": callsign,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }).encode()

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
        try:
            apigw.post_to_connection(ConnectionId=cid, Data=payload)
        except apigw.exceptions.GoneException:
            try:
                table.delete_item(Key={"connectionId": cid})
            except ClientError:
                pass
        except Exception as exc:
            logger.warning("broadcast user_left failed for %s: %s", cid, exc)


def handler(event: dict, context: object) -> dict:
    req = event.get("requestContext", {})
    connection_id: str = req["connectionId"]

    # Fetch callsign before deleting (needed for broadcast)
    try:
        resp = table.get_item(Key={"connectionId": connection_id})
        callsign: str = resp.get("Item", {}).get("callsign", "unknown")
    except ClientError as exc:
        logger.warning("GetItem failed for %s: %s", connection_id, exc)
        callsign = "unknown"

    # Remove the connection record
    try:
        table.delete_item(Key={"connectionId": connection_id})
    except ClientError as exc:
        logger.error("DeleteItem failed for %s: %s", connection_id, exc)
        return {"statusCode": 500, "body": "Internal server error"}

    # Broadcast leave event (best-effort)
    domain = req.get("domainName", "")
    stage = req.get("stage", "prod")
    if domain and not DYNAMODB_ENDPOINT:
        try:
            _broadcast_user_left(callsign, domain, stage)
        except Exception as exc:
            logger.warning("user_left broadcast error: %s", exc)

    return {"statusCode": 200, "body": "Disconnected"}
