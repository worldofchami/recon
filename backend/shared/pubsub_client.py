"""Google Cloud PubSub client wrapper."""
import json
import os
from typing import Dict, Any, Callable

from dotenv import load_dotenv
from google.cloud import pubsub_v1
from google.oauth2 import service_account

load_dotenv()


def _get_credentials():
    """
    Build Google Cloud credentials from individual environment variables, if provided.

    Required env vars (no JSON blob):
      - GCP_CLIENT_EMAIL
      - GCP_PRIVATE_KEY

    Optional (will default if missing):
      - GCP_PRIVATE_KEY_ID
      - GCP_CLIENT_ID
      - GCP_CLIENT_X509_CERT_URL

    If these are not set, the client libraries fall back to Application Default
    Credentials (e.g. GOOGLE_APPLICATION_CREDENTIALS, metadata server, etc.).
    """
    client_email = os.getenv("GCP_CLIENT_EMAIL")
    private_key = os.getenv("GCP_PRIVATE_KEY")

    if not client_email or not private_key:
        # Let Google client libraries use ADC if configured
        return None

    # Handle escaped newlines if the key is injected as a single-line secret
    private_key = private_key.replace("\\n", "\n")

    info = {
        "type": "service_account",
        "project_id": os.getenv("GCP_PROJECT_ID", "recon-dev"),
        "private_key_id": os.getenv("GCP_PRIVATE_KEY_ID", ""),
        "private_key": private_key,
        "client_email": client_email,
        "client_id": os.getenv("GCP_CLIENT_ID", ""),
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": os.getenv("GCP_CLIENT_X509_CERT_URL", ""),
    }

    return service_account.Credentials.from_service_account_info(info)


PROJECT_ID = os.getenv("GCP_PROJECT_ID", "recon-dev")
_credentials = _get_credentials()

publisher = (
    pubsub_v1.PublisherClient(credentials=_credentials)
    if _credentials
    else pubsub_v1.PublisherClient()
)
subscriber = (
    pubsub_v1.SubscriberClient(credentials=_credentials)
    if _credentials
    else pubsub_v1.SubscriberClient()
)


def publish_message(topic_name: str, data: Dict[str, Any]) -> str:
    """Publish a message to a PubSub topic."""
    topic_path = publisher.topic_path(PROJECT_ID, topic_name)
    message_data = json.dumps(data).encode("utf-8")
    future = publisher.publish(topic_path, message_data)
    return future.result()


def subscribe_to_topic(
    topic_name: str,
    subscription_name: str,
    callback: Callable[[Dict[str, Any]], None]
):
    """Subscribe to a PubSub topic."""
    topic_path = subscriber.topic_path(PROJECT_ID, topic_name)
    subscription_path = subscriber.subscription_path(PROJECT_ID, subscription_name)
    
    # Create subscription if it doesn't exist
    try:
        subscriber.create_subscription(
            name=subscription_path, topic=topic_path
        )
    except Exception:
        pass  # Subscription already exists
    
    def message_handler(message):
        """Handle incoming message."""
        data = json.loads(message.data.decode("utf-8"))
        try:
            callback(data)
            message.ack()
        except Exception as e:
            print(f"Error processing message: {e}")
            message.nack()
    
    subscriber.subscribe(subscription_path, callback=message_handler)
    return subscription_path

