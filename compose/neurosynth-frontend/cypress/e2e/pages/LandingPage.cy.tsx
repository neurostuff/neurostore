/// <reference types="cypress" />

export {};

const PAGE_NAME = 'LandingPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
    });

    it('should load successfully', () => {
        cy.visit('/');
    });

    it('should change the viewport property', () => {
        // md breakpoint is at 900px
        cy.visit('/').viewport(899, 750);
        cy.get('[data-testid="MenuIcon"]').should('be.visible');
    });
});
