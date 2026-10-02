from django.contrib.auth import get_user_model
from rest_framework import serializers
 
User = get_user_model()
 
 
class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'password')
        extra_kwargs = {'password': {'write_only': True}}
 
    def create(self, validated_data):
        user = User(username=validated_data['username'])
        user.set_password(validated_data['password'])
        user.save()
        return user


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name', 'email', 'is_staff')
        read_only_fields = ('id', 'is_staff')


class PromoteUserSerializer(serializers.Serializer):
    username = serializers.CharField(help_text='Username of the user to make superadmin')

    def validate_username(self, value):
        if not User.objects.filter(username=value).exists():
            raise serializers.ValidationError('User does not exist')
        return value
