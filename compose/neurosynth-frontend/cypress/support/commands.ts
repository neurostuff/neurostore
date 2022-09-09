import jwt from 'jsonwebtoken';

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
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }

const constructMockAuthJWT = (jwtPayload = {}): string => {
    return jwt.sign(
        {
            ...jwtPayload,
        },
        'SECRET',
        {
            keyid: 'yGR0k3tMAFj3UszOgaA6N',
        }
    );
};

Cypress.Commands.add('login', (loginMode = 'mocked', extraClaims = {}) => {
    const audience = Cypress.env('auth0Audience');
    const client_id = Cypress.env('auth0ClientId');
    const client_secret = Cypress.env('auth0ClientSecret');
    const username = Cypress.env('auth0Username');
    const password = Cypress.env('auth0Password');
    const domain = Cypress.env('auth0Domain');

    cy.log(audience)
    cy.log(client_id)
    cy.log(client_secret)
    cy.log(username)
    cy.log(password)
    cy.log(domain)
    
    /**
     * To prevent rate limiting errors form auth0, we stub our own request func and return a mocked response
     */
    if (loginMode === 'mocked') {
        cy.stub(cy, 'request').callsFake(() =>
            cy.wrap({
                body: {
                    access_token: constructMockAuthJWT({
                        iss: 'https://dev-mui7zm42.us.auth0.com/',
                        sub: 'auth0|62e0e6c9dd47048572613b4d',
                        aud: ['https://dev-mui7zm42.us.auth0.com/userinfo', audience],
                        iat: 1659719697,
                        exp: 1659806097,
                        azp: 'EmcOFhu0XAINM4EyslaKpZ3u09QlBvef',
                        scope: 'openid profile email',
                    }),
                    expires_in: 86400,
                    id_token: constructMockAuthJWT({
                        'https://neurosynth-compose/loginsCount': 871,
                        nickname: 'test-user',
                        name: 'test-user@gmail.com',
                        picture:
                            'https://s.gravatar.com/avatar/3a6e372ed11e9bc975215430fe82c28f?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fte.png',
                        updated_at: '2022-08-02T18:50:33.106Z',
                        email: 'test-user@gmail.com',
                        email_verified: false,
                        iss: `https://${domain}/`,
                        sub: 'auth0|62e0e6c9dd47048572613b4d',
                        aud: client_id,
                        iat: Math.floor(Date.now() / 1000 + 86400),
                        exp: Math.floor(Date.now() / 1000 + 86400),
                        ...extraClaims,
                    }),
                    scope: 'openid profile email read:current_user update:current_user_metadata delete:current_user_metadata create:current_user_metadata create:current_user_device_credentials delete:current_user_device_credentials update:current_user_identities',
                    token_type: 'Bearer',
                },
            })
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
            scope: 'openid profile email',
            client_id,
            client_secret,
        },
    })
        .then(({ body }) => {
            const { access_token, expires_in, id_token } = body;
            const jwtObject = jwt.decode(id_token, { complete: true }) as jwt.Jwt;
            const [header, payload, signature] = id_token.split('.');

            // localstorage object that is used by auth0.
            // we need this to ensure that auth0-react state gets updated
            const session = {
                body: {
                    access_token,
                    audience,
                    client_id,
                    decodedToken: {
                        claims: {
                            ...(jwtObject.payload as jwt.JwtPayload),
                            __raw: id_token,
                        },
                        encoded: {
                            header,
                            payload,
                            signature,
                        },
                        header: jwtObject.header,
                        user: jwtObject.payload as jwt.JwtPayload,
                    },
                    expires_in,
                    id_token,
                    scope: 'openid profile email read:current_user update:current_user_metadata delete:current_user_metadata create:current_user_metadata create:current_user_device_credentials delete:current_user_device_credentials update:current_user_identities',
                    token_type: 'Bearer',
                },
                expiresAt: Math.floor(Date.now() / 1000) + expires_in,
            };

            /**
             * There are a lot of resources online regarding integration of auth0 and cypress; however, very few of them work.
             * Finally managed to get it working by adding this in localstorage, which seems to be checked by auth0-react to determine
             * the isAuthenticated state. This code is in tandem with setting the auth0 provider cacheLocation=localstorage.
             */
            cy.addToLocalStorage(
                `@@auth0spajs@@::${client_id}::${audience}::openid profile email`,
                JSON.stringify(session)
            );
        })
        .visit('/');
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

declare global {
    namespace Cypress {
        interface Chainable {
            login(loginMode: 'real' | 'mocked', extraClaims?: any): Chainable<void>;
            mockLogin(extraClaims?: any): Chainable<void>;
            clearSessionStorage(): Chainable<void>;
            addToLocalStorage(key: string, value: string): Chainable<void>;
        }
    }
}

export {};
