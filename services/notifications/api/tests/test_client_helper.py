import importlib.util
import sys
from pathlib import Path
from unittest.mock import Mock

import requests
from django.test import TestCase

MODULE_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "examples"
    / "notifications_client.py"
)
SPEC = importlib.util.spec_from_file_location("notifications_client", MODULE_PATH)
notifications_client = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = notifications_client
SPEC.loader.exec_module(notifications_client)

NotificationClient = notifications_client.NotificationClient
NotificationRequest = notifications_client.NotificationRequest
build_deduplication_key = notifications_client.build_deduplication_key


def _request():
    return NotificationRequest(
        recipient_user_id="3f2c9a1e-7b4d-4c6a-9e2f-1a2b3c4d5e6f",
        type="application_confirmed",
        title="Application confirmed",
        message="Your internship is confirmed.",
        related_object_type="application",
        related_object_id="b6a1f0c2-8d3e-4f5a-9b7c-0d1e2f3a4b5c",
        deduplication_key="application:b6a1f0c2:confirmed:recipient:3f2c9a1e",
    )


def _client(session):
    return NotificationClient(
        base_url="http://notifications:8000",
        service_token="secret",
        base_delay=0,
        sleep=lambda _: None,
        session=session,
    )


class DeduplicationKeyTests(TestCase):
    def test_key_has_the_documented_shape(self):
        key = build_deduplication_key(
            "application",
            "b6a1f0c2-8d3e-4f5a-9b7c-0d1e2f3a4b5c",
            "confirmed",
            "3f2c9a1e-7b4d-4c6a-9e2f-1a2b3c4d5e6f",
        )

        self.assertEqual(
            key,
            "application:b6a1f0c2-8d3e-4f5a-9b7c-0d1e2f3a4b5c:"
            "confirmed:recipient:3f2c9a1e-7b4d-4c6a-9e2f-1a2b3c4d5e6f",
        )


class NotificationClientTests(TestCase):
    def test_send_returns_the_created_payload(self):
        session = Mock()
        session.post.return_value = Mock(status_code=201, text="", json=Mock(return_value={"id": "n1"}))

        result = _client(session).send(_request())

        self.assertEqual(result, {"id": "n1"})
        self.assertEqual(session.post.call_count, 1)
        self.assertEqual(
            session.post.call_args.kwargs["headers"]["X-Service-Token"], "secret"
        )

    def test_retries_server_errors_then_succeeds(self):
        session = Mock()
        session.post.side_effect = [
            Mock(status_code=503, text="unavailable"),
            Mock(status_code=200, text="", json=Mock(return_value={"id": "n2"})),
        ]

        result = _client(session).send(_request())

        self.assertEqual(result, {"id": "n2"})
        self.assertEqual(session.post.call_count, 2)

    def test_does_not_retry_client_errors(self):
        session = Mock()
        session.post.return_value = Mock(status_code=400, text="bad request")

        result = _client(session).send(_request())

        self.assertIsNone(result)
        self.assertEqual(session.post.call_count, 1)

    def test_retries_timeouts(self):
        session = Mock()
        session.post.side_effect = [
            requests.Timeout("slow"),
            Mock(status_code=201, text="", json=Mock(return_value={"id": "n3"})),
        ]

        result = _client(session).send(_request())

        self.assertEqual(result, {"id": "n3"})
        self.assertEqual(session.post.call_count, 2)

    def test_send_never_raises_after_exhausting_attempts(self):
        session = Mock()
        session.post.side_effect = requests.ConnectionError("down")

        result = _client(session).send(_request())

        self.assertIsNone(result)
        self.assertEqual(session.post.call_count, 3)

    def test_notify_on_commit_runs_after_the_transaction_commits(self):
        session = Mock()
        session.post.return_value = Mock(status_code=201, text="", json=Mock(return_value={}))
        client = _client(session)

        with self.captureOnCommitCallbacks(execute=True):
            client.notify_on_commit(_request())

        self.assertEqual(session.post.call_count, 1)

    def test_notify_on_commit_accepts_keyword_fields(self):
        session = Mock()
        session.post.return_value = Mock(status_code=201, text="", json=Mock(return_value={}))
        client = _client(session)
        request = _request()

        with self.captureOnCommitCallbacks(execute=True):
            client.notify_on_commit(
                recipient_user_id=request.recipient_user_id,
                type=request.type,
                title=request.title,
                message=request.message,
                related_object_type=request.related_object_type,
                related_object_id=request.related_object_id,
                deduplication_key=request.deduplication_key,
            )

        self.assertEqual(session.post.call_count, 1)
