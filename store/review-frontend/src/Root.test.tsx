import { Auth0Provider, useAuth0, type Auth0ContextInterface } from '@auth0/auth0-react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Root } from './Root';
import { makeBundle } from './test/bundles';
import { fakeServer } from './test/fakeServer';
import { API_BASE } from './test/spec';

vi.mock('@auth0/auth0-react', () => ({
    Auth0Provider: vi.fn(({ children }: { children: ReactNode }) => children),
    useAuth0: vi.fn(),
}));

const ENV = {
    BASE_URL: '/review/',
    VITE_APP_AUTH0_DOMAIN: 'auth.test',
    VITE_APP_AUTH0_CLIENT_ID: 'client',
    VITE_APP_AUTH0_AUDIENCE: 'https://api.test',
    VITE_APP_NEUROSTORE_API_DOMAIN: API_BASE,
};

function signedIn(isAuthenticated: boolean) {
    const auth = {
        isLoading: false,
        isAuthenticated,
        loginWithRedirect: vi.fn(),
        getAccessTokenSilently: vi.fn(async () => 'token-1'),
    };
    vi.mocked(useAuth0).mockReturnValue(auth as unknown as Auth0ContextInterface);
    return auth;
}

const bundle = makeBundle({}, 'text', { source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' } });

describe('Root', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.mocked(useAuth0).mockReset();
        window.history.replaceState(null, '', '/');
    });

    it('asks a signed-out user to sign in, and sends nothing to the API', () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        const auth = signedIn(false);
        window.history.replaceState(null, '', '/review/papers/S1');
        render(<Root env={ENV} />);
        fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
        expect(auth.loginWithRedirect).toHaveBeenCalledWith({ appState: { returnTo: '/review/papers/S1' } });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('calls the API with the signed-in user’s bearer token', async () => {
        const server = fakeServer([bundle]);
        vi.stubGlobal('fetch', server.fetch);
        const auth = signedIn(true);
        window.history.replaceState(null, '', '/review');
        render(<Root env={ENV} />);
        expect(await screen.findByRole('link', { name: /^A paper/ })).toBeInTheDocument();
        expect(auth.getAccessTokenSilently).toHaveBeenCalled();
        expect(server.requests).toMatchObject([{ path: '/api/review/sources/', problems: [] }]);
    });

    it('sends the token Auth0 gives as the bearer token', async () => {
        const server = fakeServer([bundle]);
        const fetch = vi.fn(server.fetch);
        vi.stubGlobal('fetch', fetch);
        signedIn(true);
        window.history.replaceState(null, '', '/review');
        render(<Root env={ENV} />);
        expect(await screen.findByRole('link', { name: /^A paper/ })).toBeInTheDocument();
        const sent = fetch.mock.calls.map(([, init]) => new Headers(init?.headers).get('Authorization'));
        expect(sent).not.toHaveLength(0);
        expect(new Set(sent)).toEqual(new Set(['Bearer token-1']));
    });

    it('configures Auth0 from the environment, with the API audience and this page as the redirect', () => {
        const server = fakeServer([bundle]);
        vi.stubGlobal('fetch', server.fetch);
        signedIn(true);
        window.history.replaceState(null, '', '/review');
        render(<Root env={ENV} />);
        expect(vi.mocked(Auth0Provider).mock.calls.at(-1)?.[0]).toMatchObject({
            domain: 'auth.test',
            clientId: 'client',
            authorizationParams: { audience: 'https://api.test', redirect_uri: `${window.location.origin}/review/` },
        });
    });

    it('in fixture mode reads the fixtures without signing in', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) =>
                url === '/review/fixtures/index.json'
                    ? new Response(JSON.stringify([{ id: 'F1', label: 'A fixture', total: 0 }]))
                    : new Response('missing', { status: 404 })
            )
        );
        window.history.replaceState(null, '', '/review');
        render(<Root env={{ BASE_URL: '/review/', VITE_APP_REVIEW_FIXTURES: '1' }} />);
        expect(await screen.findByRole('link', { name: /^A fixture/ })).toBeInTheDocument();
        expect(useAuth0).not.toHaveBeenCalled();
    });
});
