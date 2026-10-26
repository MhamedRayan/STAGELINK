import time
 
import jwt
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
 
from api.models import Notification
 
# Long enough for every HMAC algorithm used in these tests (HS256/HS384).
TEST_JWT_KEY = "test-jwt-secret-key-that-is-long-enough-for-every-hmac-algorithm-used-here"
NOTIFICATIONS_URL = "/api/notifications/"
 
 
def _make_token(user_id=42, key=TEST_JWT_KEY, algorithm="HS256", expires_in=300, **extra_claims):
    payload = {"user_id": user_id, "role": "student"}
    if expires_in is not None:
        payload["exp"] = int(time.time()) + expires_in
    payload.update({name: value for name, value in extra_claims.items() if value is not None})
    return jwt.encode(payload, key, algorithm=algorithm)
 
 
def _create_notification(recipient_user_id, deduplication_key):
    return Notification.objects.create(
        recipient_user_id=recipient_user_id,
        type=Notification.Type.GENERIC,
        title="Title",
        message="Message",
        deduplication_key=deduplication_key,
    )
 
 
@override_settings(
    JWT_ALGORITHM="HS256",
    JWT_SIGNING_KEY=TEST_JWT_KEY,
    JWT_USER_ID_CLAIM="user_id",
    JWT_ROLE_CLAIM="role",
    DEV_AUTH_ENABLED=False,
    INTERNAL_SERVICE_TOKEN="test-service-token",
)
class JWTAuthenticationTests(TestCase):
    def setUp(self):
        self.api_client = APIClient()
        self.own_notification = _create_notification(42, "key-own")
        self.other_notification = _create_notification(77, "key-other")
 
    def _get_with_token(self, token, url=NOTIFICATIONS_URL):
        return self.api_client.get(url, HTTP_AUTHORIZATION=f"Bearer {token}")
 
    # --- accepted -------------------------------------------------------
    def test_valid_token_lists_only_own_notifications(self):
        response = self._get_with_token(_make_token(user_id=42))
 
        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.json()["results"]]
        self.assertEqual(ids, [self.own_notification.id])
 
    def test_user_id_can_be_a_numeric_string(self):
        response = self._get_with_token(_make_token(user_id="42"))
 
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)
 
    def test_valid_token_cannot_mark_another_users_notification(self):
        response = self.api_client.patch(
            f"/api/notifications/{self.other_notification.id}/read/",
            HTTP_AUTHORIZATION=f"Bearer {_make_token(user_id=42)}",
        )
 
        self.assertEqual(response.status_code, 404)
 
    @override_settings(JWT_USER_ID_CLAIM="sub")
    def test_user_id_claim_name_is_configurable(self):
        # PyJWT requires the standard "sub" claim to be a string.
        token = jwt.encode({"sub": "42", "exp": int(time.time()) + 300}, TEST_JWT_KEY, algorithm="HS256")
 
        self.assertEqual(self._get_with_token(token).status_code, 200)
 
    # --- rejected -------------------------------------------------------
    def test_expired_token_is_rejected(self):
        self.assertEqual(self._get_with_token(_make_token(expires_in=-10)).status_code, 401)
 
    def test_token_without_expiry_is_rejected(self):
        self.assertEqual(self._get_with_token(_make_token(expires_in=None)).status_code, 401)
 
    def test_token_signed_with_another_key_is_rejected(self):
        token = _make_token(key="another-secret-key-with-at-least-32-bytes!!")
 
        self.assertEqual(self._get_with_token(token).status_code, 401)
 
    def test_unsigned_none_algorithm_token_is_rejected(self):
        token = jwt.encode({"user_id": 42, "exp": int(time.time()) + 300}, None, algorithm="none")
 
        self.assertEqual(self._get_with_token(token).status_code, 401)
 
    def test_other_algorithm_than_configured_is_rejected(self):
        token = _make_token(algorithm="HS384")
 
        self.assertEqual(self._get_with_token(token).status_code, 401)
 
    def test_refresh_token_is_rejected(self):
        token = _make_token(token_type="refresh")
 
        self.assertEqual(self._get_with_token(token).status_code, 401)
 
    def test_access_token_type_is_accepted(self):
        token = _make_token(token_type="access")
 
        self.assertEqual(self._get_with_token(token).status_code, 200)
 
    def test_token_without_user_id_is_rejected(self):
        token = jwt.encode({"exp": int(time.time()) + 300}, TEST_JWT_KEY, algorithm="HS256")
 
        self.assertEqual(self._get_with_token(token).status_code, 401)
 
    def test_non_numeric_user_id_is_rejected(self):
        self.assertEqual(self._get_with_token(_make_token(user_id="abc")).status_code, 401)
 
    def test_zero_or_negative_user_id_is_rejected(self):
        for bad_user_id in [0, -5]:
            self.assertEqual(self._get_with_token(_make_token(user_id=bad_user_id)).status_code, 401)
 
    def test_garbage_token_is_rejected(self):
        self.assertEqual(self._get_with_token("not-a-jwt").status_code, 401)
 
    def test_malformed_authorization_header_is_rejected(self):
        response = self.api_client.get(NOTIFICATIONS_URL, HTTP_AUTHORIZATION="Bearer one two")
 
        self.assertEqual(response.status_code, 401)
 
    def test_request_without_token_is_unauthorized(self):
        self.assertEqual(self.api_client.get(NOTIFICATIONS_URL).status_code, 401)
 
    @override_settings(JWT_SIGNING_KEY="")
    def test_every_token_is_rejected_when_no_key_is_configured(self):
        self.assertEqual(self._get_with_token(_make_token()).status_code, 401)
 
    @override_settings(JWT_ALGORITHM="none")
    def test_unsupported_configured_algorithm_rejects_tokens(self):
        self.assertEqual(self._get_with_token(_make_token()).status_code, 401)
 
    # --- separation from the internal endpoint --------------------------
    def test_user_token_cannot_call_the_internal_endpoint(self):
        response = self.api_client.post(
            "/api/internal/notifications/",
            {
                "recipient_user_id": 42,
                "type": "generic",
                "title": "t",
                "message": "m",
                "deduplication_key": "forged",
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {_make_token()}",
        )
 
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Notification.objects.filter(deduplication_key="forged").exists())
 
    # --- dev header does not weaken JWT ----------------------------------
    @override_settings(DEV_AUTH_ENABLED=True)
    def test_invalid_bearer_token_is_not_rescued_by_dev_header(self):
        response = self.api_client.get(
            NOTIFICATIONS_URL,
            HTTP_AUTHORIZATION="Bearer not-a-jwt",
            HTTP_X_USER_ID="42",
        )
 
        self.assertEqual(response.status_code, 401)
