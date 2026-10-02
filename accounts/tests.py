from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


class PromoteUserAPITests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username='alice', password='test-pass-123')
        self.target = user_model.objects.create_user(username='bob', password='test-pass-123')
        self.root = user_model.objects.create_superuser(username='root', password='test-pass-123')

    def authenticate(self, user):
        access = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

    def test_promote_requires_authentication(self):
        response = self.client.post('/account/promote/', {'username': 'bob'})
        self.assertEqual(response.status_code, 401)

    def test_promote_forbidden_for_regular_user(self):
        self.authenticate(self.user)
        response = self.client.post('/account/promote/', {'username': 'bob'})
        self.assertEqual(response.status_code, 403)
        self.target.refresh_from_db()
        self.assertFalse(self.target.is_superuser)

    def test_superuser_promotes_existing_user(self):
        self.authenticate(self.root)
        response = self.client.post('/account/promote/', {'username': 'bob'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['username'], 'bob')
        self.target.refresh_from_db()
        self.assertTrue(self.target.is_superuser)
        self.assertTrue(self.target.is_staff)

    def test_promote_rejects_unknown_or_missing_username(self):
        self.authenticate(self.root)
        response = self.client.post('/account/promote/', {'username': 'nobody'})
        self.assertEqual(response.status_code, 400)
        response = self.client.post('/account/promote/', {})
        self.assertEqual(response.status_code, 400)

    def test_promote_is_documented_in_swagger(self):
        response = self.client.get('/swagger/?format=openapi')
        self.assertEqual(response.status_code, 200)
        self.assertIn('/account/promote/', response.json()['paths'])