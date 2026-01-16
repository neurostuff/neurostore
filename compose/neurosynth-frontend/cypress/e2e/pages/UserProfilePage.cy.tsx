/// <reference types="cypress" />

export {};

const PATH = '/user-profile';
const PAGE_NAME = 'UserProfilePage';

describe(PAGE_NAME, () => {
    const TEST_USER_EMAIL = 'test-user@gmail.com';
    const TEST_USER_NAME = 'Test User';

    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
    });

    describe('Basic Page Visibility', () => {
        it('should load the page successfully after login', () => {
            cy.login('mocked');
            cy.visit(PATH);
            cy.contains('User:').should('be.visible');
            cy.contains('Email:').should('be.visible');
            cy.contains('button', 'Reset Password').should('be.visible');
        });
    });

    describe('User Information Display', () => {
        it('should display the current user email', () => {
            cy.login('mocked');
            cy.visit(PATH);
            cy.contains(TEST_USER_EMAIL).should('be.visible');
        });

        it('should display the current user name', () => {
            cy.login('mocked');
            cy.visit(PATH);
            cy.contains(TEST_USER_NAME).should('be.visible');
        });
    });

    describe('Reset Password - Google Login', () => {
        beforeEach(() => {
            // Mock a Google login by setting sub to include 'google'
            cy.login('mocked', {
                sub: 'google-oauth2|123456789',
                email: TEST_USER_EMAIL,
                name: 'Google User',
            });
            cy.visit(PATH);
        });

        it('should show an error message when attempting to reset password', () => {
            cy.contains('button', 'Reset Password').click();
            cy.contains('You used google to login').should('be.visible');
            cy.contains('please sign into your google account and reset your password there').should('be.visible');
        });

        it('should not trigger the reset password API request', () => {
            cy.intercept('POST', '**/dbconnections/change_password', {
                statusCode: 200,
                body: { success: true },
            }).as('resetPasswordRequest');

            cy.contains('button', 'Reset Password').click();

            // Verify no request is made
            cy.get('@resetPasswordRequest.all').should('have.length', 0);
        });
    });

    describe('Reset Password - GitHub Login', () => {
        beforeEach(() => {
            // Mock a GitHub login by setting sub to include 'github'
            cy.login('mocked', {
                sub: 'github|987654321',
                email: TEST_USER_EMAIL,
                name: 'GitHub User',
            });
            cy.visit(PATH);
        });

        it('should show an error message when attempting to reset password', () => {
            cy.contains('button', 'Reset Password').click();
            cy.contains('You used github to login').should('be.visible');
            cy.contains('please sign into your github account and reset your password there').should('be.visible');
        });

        it('should not trigger the reset password API request', () => {
            cy.intercept('POST', '**/dbconnections/change_password', {
                statusCode: 200,
                body: { success: true },
            }).as('resetPasswordRequest');

            cy.contains('button', 'Reset Password').click();

            // Verify no request is made
            cy.get('@resetPasswordRequest.all').should('have.length', 0);
        });
    });

    describe('Reset Password - Auth0 Login', () => {
        beforeEach(() => {
            // Mock an Auth0 login by setting sub to include 'auth0'
            cy.login('mocked', {
                sub: 'auth0|62e0e6c9dd47048572613b4d',
                email: TEST_USER_EMAIL,
                name: 'Auth0 User',
            });
        });

        it('should intercept the reset password request', () => {
            cy.intercept('POST', '**/dbconnections/change_password', {
                statusCode: 200,
                body: "We've just sent you an email to reset your password.",
            }).as('resetPasswordRequest');

            cy.visit(PATH);
            cy.contains('button', 'Reset Password').click();

            cy.wait('@resetPasswordRequest').then((interception) => {
                // Verify the request was made
                expect(interception.request.method).to.equal('POST');

                // Verify request body contains the correct email
                expect(interception.request.body).to.have.property('email', TEST_USER_EMAIL);
                expect(interception.request.body).to.have.property('connection', 'Username-Password-Authentication');
                expect(interception.request.body).to.have.property('client_id');
            });
        });

        it('should show success message after successful password reset request', () => {
            cy.intercept('POST', '**/dbconnections/change_password', {
                statusCode: 200,
                body: "We've just sent you an email to reset your password.",
            }).as('resetPasswordRequest');

            cy.visit(PATH);
            cy.contains('button', 'Reset Password').click();

            cy.wait('@resetPasswordRequest');
            cy.contains('Reset password email sent').should('be.visible');
        });

        it('should show error message when password reset request fails', () => {
            cy.intercept('POST', '**/dbconnections/change_password', {
                statusCode: 400,
                body: { error: 'Bad Request' },
            }).as('resetPasswordRequest');

            cy.visit(PATH);
            cy.contains('button', 'Reset Password').click();

            cy.wait('@resetPasswordRequest');
            cy.contains('Error sending reset password email').should('be.visible');
        });
    });
});
