from django.http import HttpRequest, JsonResponse


def health(request: HttpRequest) -> JsonResponse:
    """Lightweight liveness/readiness probe used by Docker and load balancers."""
    return JsonResponse({"status": "ok", "service": "internships"})
