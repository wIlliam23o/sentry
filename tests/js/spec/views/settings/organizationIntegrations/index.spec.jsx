/*global global*/
import React from 'react';

import {Client} from 'app/api';
import {mount} from 'enzyme';
import {
  openIntegrationDetails,
  openSentryAppDetailsModal,
} from 'app/actionCreators/modal';
import {OrganizationIntegrations} from 'app/views/organizationIntegrations';

jest.mock('app/actionCreators/modal', () => ({
  openIntegrationDetails: jest.fn(),
  openSentryAppDetailsModal: jest.fn(),
}));

describe('OrganizationIntegrations', () => {
  let wrapper;

  let org;
  let sentryApp;

  let githubProvider;
  let jiraProvider;
  let vstsProvider;

  let githubIntegration;
  let jiraIntegration;

  let params;
  let routerContext;

  let sentryAppsRequest;
  let sentryInstallsRequest;

  let focus;
  let open;

  beforeEach(() => {
    Client.clearMockResponses();

    org = TestStubs.Organization();
    sentryApp = TestStubs.SentryApp();

    githubProvider = TestStubs.GitHubIntegrationProvider({
      integrations: [],
      isInstalled: false,
    });

    jiraProvider = TestStubs.JiraIntegrationProvider();
    vstsProvider = TestStubs.VstsIntegrationProvider();

    githubIntegration = TestStubs.GitHubIntegration();
    jiraIntegration = TestStubs.JiraIntegration();

    params = {orgId: org.slug};

    routerContext = TestStubs.routerContext();

    focus = jest.fn();
    open = jest.fn().mockReturnValue({focus});
    global.open = open;

    Client.addMockResponse({
      url: `/organizations/${org.slug}/integrations/`,
      body: [],
    });

    Client.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/`,
      body: {providers: [githubProvider, jiraProvider]},
    });

    Client.addMockResponse({
      url: `/organizations/${org.slug}/plugins/`,
      body: [],
    });

    Client.addMockResponse({
      url: `/organizations/${org.slug}/repos/?status=unmigratable`,
      body: [],
    });

    sentryAppsRequest = Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-apps/`,
      body: [],
    });

    sentryInstallsRequest = Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-app-installations/`,
      body: [],
    });

    wrapper = mount(
      <OrganizationIntegrations organization={org} params={params} />,
      routerContext
    );
  });

  describe('render()', () => {
    describe('without integrations', () => {
      it('renders with sentry-apps', () => {
        sentryAppsRequest = Client.addMockResponse({
          url: `/organizations/${org.slug}/sentry-apps/`,
          body: [sentryApp],
        });

        org = {...org, features: ['sentry-apps']};

        mount(
          <OrganizationIntegrations organization={org} params={params} />,
          routerContext
        );

        expect(sentryAppsRequest).toHaveBeenCalled();
        expect(sentryInstallsRequest).toHaveBeenCalled();
      });

      it('renders a Learn More modal for Sentry Apps', () => {
        sentryAppsRequest = Client.addMockResponse({
          url: `/organizations/${org.slug}/sentry-apps/`,
          body: [sentryApp],
        });

        org = {...org, features: ['sentry-apps']};

        wrapper = mount(
          <OrganizationIntegrations organization={org} params={params} />,
          routerContext
        );

        wrapper.find('SentryApplicationRow Link').simulate('click');

        expect(openSentryAppDetailsModal).toHaveBeenCalledWith({
          sentryApp,
          isInstalled: false,
          onInstall: expect.any(Function),
          organization: org,
        });
      });

      it('Does`t hit sentry apps endpoints when sentry-apps isn`t present', () => {
        expect(sentryAppsRequest).not.toHaveBeenCalled();
        expect(sentryInstallsRequest).not.toHaveBeenCalled();
      });

      it('Displays integration providers', () => {
        expect(wrapper).toMatchSnapshot();
      });

      it('Opens the integration dialog on install', () => {
        const options = {
          provider: githubProvider,
          onAddIntegration: wrapper.instance().onInstall,
          organization: routerContext.context.organization,
        };

        wrapper
          .find('Button')
          .first()
          .simulate('click');

        expect(openIntegrationDetails).toHaveBeenCalledWith(options);
      });
    });

    describe('with installed integrations', () => {
      let updatedIntegration;

      beforeEach(() => {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/`,
          body: [githubIntegration, jiraIntegration],
        });

        wrapper = mount(
          <OrganizationIntegrations organization={org} params={params} />,
          routerContext
        );

        updatedIntegration = Object.assign({}, githubIntegration, {
          domain_name: 'updated-integration.github.com',
          icon: 'http://example.com/updated-integration-icon.png',
          name: 'Updated Integration',
        });
      });

      it('Displays InstalledIntegration', () => {
        expect(wrapper).toMatchSnapshot();
      });

      it('Merges installed integrations', () => {
        wrapper.instance().onInstall(updatedIntegration);

        expect(wrapper.instance().state.integrations).toHaveLength(2);
        expect(wrapper.instance().state.integrations[1]).toBe(updatedIntegration);
      });

      it('Deletes an integration', () => {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/${jiraIntegration.id}/`,
          method: 'DELETE',
          statusCode: 200,
        });

        wrapper.instance().onRemove(jiraIntegration);

        expect(wrapper.instance().state.integrations).toHaveLength(1);
        expect(wrapper.instance().state.integrations[0]).toBe(githubIntegration);
      });
    });

    describe('with matching plugins installed', () => {
      beforeEach(() => {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/`,
          body: [githubIntegration],
        });

        Client.addMockResponse({
          url: `/organizations/${org.slug}/config/integrations/`,
          body: {providers: [githubProvider, jiraProvider, vstsProvider]},
        });

        Client.addMockResponse({
          url: `/organizations/${org.slug}/plugins/`,
          body: [
            {
              slug: 'github',
              enabled: true,
            },
            {
              slug: 'vsts',
              enabled: true,
            },
            {
              slug: 'jira',
              enabled: true,
            },
          ],
        });

        Client.addMockResponse({
          url: `/organizations/${org.slug}/repos/?status=unmigratable`,
          body: [
            {
              provider: {
                id: 'github',
                name: 'GitHub',
              },
              name: 'Test-Org/foo',
            },
          ],
        });

        wrapper = mount(
          <OrganizationIntegrations organization={org} params={params} />,
          routerContext
        );
      });

      it('displays an Update when the Plugin is enabled but a new Integration is not', () => {
        expect(
          wrapper
            .find('ProviderRow')
            .filterWhere(n => n.key() === 'vsts')
            .find('Button')
            .first()
            .text()
        ).toBe('Update');
      });

      it('displays Add Another button when both Integration and Plugin are enabled', () => {
        expect(
          wrapper
            .find('ProviderRow')
            .filterWhere(n => n.key() === 'github')
            .find('Button')
            .first()
            .text()
        ).toBe('Add Another');
      });

      it('display an Install button when its not an upgradable Integration', () => {
        expect(
          wrapper
            .find('ProviderRow')
            .filterWhere(n => n.key() === 'jira')
            .find('Button')
            .first()
            .text()
        ).toBe('Install');
      });
    });
  });
});
