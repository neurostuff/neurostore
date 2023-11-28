/// <reference types="cypress" />

export {};

const PAGE_NAME = 'LandingPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/base-studies/**`, { fixture: 'baseStudies' }).as(
            'baseStudiesFixture'
        );
        cy.intercept('GET', `**/api/points/**`, { fixture: 'points' }).as('pointsFixture');
    });

    it('should load successfully', () => {
        cy.visit('/').wait('@baseStudiesFixture').wait('@pointsFixture');
    });

    it('should authenticate for real and redirect to projects page', () => {
        cy.login('real').visit('/');
        cy.contains('Projects');
    });

    it('should authenticate and redirect to the projects page', () => {
        cy.login('mocked').visit('/');
        cy.contains('Projects');
    });

    it('should change the viewport property', () => {
        // md breakpoint is at 900px
        cy.visit('/').viewport(899, 750);
        cy.get('[data-testid="MenuIcon"]').should('be.visible');
    });
});
