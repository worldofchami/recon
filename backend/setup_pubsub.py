import os
import sys
sys.path.append('/app')
from google.cloud import pubsub_v1

os.environ["PUBSUB_EMULATOR_HOST"] = "pubsub-emulator:8085"
project_id = "direla-recon-local"

publisher = pubsub_v1.PublisherClient()
subscriber = pubsub_v1.SubscriberClient()

# Define the architecture of our messaging system
topics = ["txn-normalized", "txn-updates", "workflow-events"]
subscriptions = [
    ("txn-normalized", "reconciliation-engine-sub"),
    ("txn-updates", "workflow-orchestrator-sub")
]

for topic in topics:
    path = publisher.topic_path(project_id, topic)
    try:
        publisher.create_topic(name=path)
        print(f"✅ Topic Created: {topic}")
    except:
        print(f"🟡 Topic Exists: {topic}")

for topic, sub in subscriptions:
    t_path = publisher.topic_path(project_id, topic)
    s_path = subscriber.subscription_path(project_id, sub)
    try:
        subscriber.create_subscription(name=s_path, topic=t_path)
        print(f"✅ Subscription Created: {sub}")
    except:
        print(f"🟡 Subscription Exists: {sub}")