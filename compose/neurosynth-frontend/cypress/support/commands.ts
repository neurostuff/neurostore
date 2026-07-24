import * as jose from 'jose';

/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

const AUTH0_CACHE_PREFIX = '@@auth0spajs@@';
const AUTH0_USER_CACHE_SUFFIX = '@@user@@';
const DEFAULT_MOCKED_USER_SUB = 'auth0|62e0e6c9dd47048572613b4d';

const normalizeAuth0Scope = (scope: string) =>
    Array.from(new Set(scope.trim().split(/\s+/))).join(' ');

const constructMockAuthJWT = async (jwtPayload = {}): Promise<string> => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const jwt = await new jose.SignJWT({ ...jwtPayload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(nowInSeconds)
        .setExpirationTime(nowInSeconds + 86400)
        .sign(new TextEncoder().encode('SECRET'));
    return jwt;
};

const createMockRequest = async (
    audience: string,
    client_id: string,
    domain: string,
    scope: string,
    extraClaims = {}
) => {
    const access_token = await constructMockAuthJWT({
        iss: 'https://dev-mui7zm42.us.auth0.com/',
        sub: DEFAULT_MOCKED_USER_SUB,
        aud: ['https://dev-mui7zm42.us.auth0.com/userinfo', audience],
        azp: 'EmcOFhu0XAINM4EyslaKpZ3u09QlBvef',
        scope: scope,
    });

    const id_token = await constructMockAuthJWT({
        'https://neurosynth-compose/loginsCount': 871,
        nickname: 'test-user',
        name: 'Test User',
        picture:
            'https://s.gravatar.com/avatar/3a6e372ed11e9bc975215430fe82c28f?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fte.png',
        updated_at: '2022-08-02T18:50:33.106Z',
        email: 'test-user@gmail.com',
        email_verified: false,
        iss: `https://${domain}/`,
        sub: DEFAULT_MOCKED_USER_SUB,
        aud: client_id,
        ...extraClaims,
    });

    return {
        body: {
            access_token: access_token,
            refresh_token: 'mock-refresh-token',
            expires_in: 86400,
            id_token: id_token,
            scope: scope,
            token_type: 'Bearer',
        },
    };
};

const buildAuth0LocalStorageEntries = ({
    access_token,
    audience,
    client_id,
    expires_in,
    id_token,
    refresh_token,
    scope,
}: {
    access_token: string;
    audience: string;
    client_id: string;
    expires_in: number;
    id_token: string;
    refresh_token: string;
    scope: string;
}) => {
    const jwtObject = jose.decodeJwt(id_token);
    const normalizedScope = normalizeAuth0Scope(scope);
    const decodedToken = {
        claims: {
            ...jwtObject,
            __raw: id_token,
        },
        user: {
            sub: jwtObject.sub,
            email: jwtObject.email,
            name: jwtObject.name,
            nickname: jwtObject.nickname,
            picture: jwtObject.picture,
            updated_at: jwtObject.updated_at,
            email_verified: jwtObject.email_verified,
        },
    };

    const tokenCacheKey = `${AUTH0_CACHE_PREFIX}::${client_id}::${audience}::${normalizedScope}`;
    const tokenCacheEntry = {
        body: {
            access_token,
            audience,
            client_id,
            decodedToken,
            expires_in,
            id_token,
            refresh_token,
            scope: normalizedScope,
            token_type: 'Bearer',
        },
        expiresAt: Math.floor(Date.now() / 1000) + expires_in,
    };

    const idTokenCacheKey = `${AUTH0_CACHE_PREFIX}::${client_id}::${AUTH0_USER_CACHE_SUFFIX}`;
    const idTokenCacheEntry = {
        id_token,
        decodedToken,
    };

    return { tokenCacheKey, tokenCacheEntry, idTokenCacheKey, idTokenCacheEntry };
};

Cypress.Commands.add('login', (loginMode = 'mocked', extraClaims = {}) => {
    const audience = Cypress.env('auth0Audience');
    const client_id = Cypress.env('auth0ClientId');
    const client_secret = Cypress.env('auth0ClientSecret');
    const username = Cypress.env('auth0Username');
    const password = Cypress.env('auth0Password');
    const domain = Cypress.env('auth0Domain');

    const scope = 'openid profile email offline_access';

    /**
     * To prevent rate limiting errors form auth0, we stub our own request func and return a mocked response
     */
    if (loginMode === 'mocked') {
        cy.stub(cy, 'request').callsFake(() =>
            cy.wrap(createMockRequest(audience, client_id, domain, scope, extraClaims))
        );
    }

    /**
     * this request will show up in the cypress UI as a non-filled circular indicator. This does not mean it's stubbed, just that
     * the request is being made through cypress itself
     */
    cy.request({
        method: 'POST',
        url: `https://${domain}/oauth/token`,
        body: {
            grant_type: 'password',
            realm: 'Username-Password-Authentication',
            username,
            password,
            audience,
            scope,
            client_id,
            client_secret,
        },
    }).then(({ body }) => {
        const { access_token, expires_in, id_token, refresh_token } = body;
        const { tokenCacheKey, tokenCacheEntry, idTokenCacheKey, idTokenCacheEntry } = buildAuth0LocalStorageEntries({
            access_token,
            audience,
            client_id,
            expires_in,
            id_token,
            refresh_token: refresh_token || 'mock-refresh-token',
            scope,
        });

        /**
         * Auth0 SPA JS v2 reads the user profile from a dedicated @@user@@ cache entry.
         * The access-token entry alone is not enough for getUser() / isAuthenticated.
         */
        cy.addToLocalStorage(tokenCacheKey, JSON.stringify(tokenCacheEntry));
        cy.addToLocalStorage(idTokenCacheKey, JSON.stringify(idTokenCacheEntry));
    });
});

Cypress.Commands.add('clearSessionStorage', () => {
    cy.window().then((window) => {
        window.sessionStorage.clear();
    });
});

Cypress.Commands.add('addToLocalStorage', (key: string, value: string) => {
    cy.window().then((window) => {
        window.localStorage.setItem(key, value);
    });
});

Cypress.Commands.overwrite('log', (subject, message) => cy.task('log', message));

declare global {
    namespace Cypress {
        interface Chainable {
            login(loginMode: 'real' | 'mocked', extraClaims?: any): Chainable<void>;
            clearSessionStorage(): Chainable<void>;
            addToLocalStorage(key: string, value: string): Chainable<void>;
        }
    }
}

export {};
