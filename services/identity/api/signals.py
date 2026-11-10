from django.db.models.signals import post_save
from django.dispatch import receiver

from api.models import User
from api.profile_services import ensure_role_profile


@receiver(post_save, sender=User, dispatch_uid="api.create_user_role_profile")
def create_role_profile_for_new_user(sender, instance, created, **kwargs):
    if created:
        ensure_role_profile(instance)
