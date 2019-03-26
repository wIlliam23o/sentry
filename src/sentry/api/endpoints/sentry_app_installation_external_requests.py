from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.api.bases import SentryAppInstallationBaseEndpoint
from sentry.mediators import external_requests
from sentry.models import Project


class SentryAppInstallationExternalRequestsEndpoint(SentryAppInstallationBaseEndpoint):
    def get(self, request, installation):
        if not features.has('organizations:sentry-apps',
                            installation.organization,
                            actor=request.user):
            return Response(status=404)

        try:
            project = Project.objects.get(
                id=request.GET.get('projectId'),
                organization_id=installation.organization_id,
            )
        except Project.DoesNotExist:
            project = None

        kwargs = {
            'install': installation,
            'uri': request.GET.get('uri'),
            'query': request.GET.get('query'),
        }

        if project:
            kwargs.update({'project': project})

        try:
            choices = external_requests.AsyncSelectRequester.run(**kwargs)
        except Exception:
            return Response({'error': 'Error communicating with Sentry App service'}, status=400)

        return Response(choices)
