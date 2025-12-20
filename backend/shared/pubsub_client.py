"""Google Cloud PubSub client wrapper."""
from google.cloud import pubsub_v1
import json
import os
from typing import Dict, Any, Callable
from dotenv import load_dotenv

load_dotenv()

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "recon-dev")
publisher = pubsub_v1.PublisherClient()
subscriber = pubsub_v1.SubscriberClient()


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

