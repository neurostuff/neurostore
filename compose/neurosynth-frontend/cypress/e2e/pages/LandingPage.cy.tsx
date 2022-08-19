/// <reference types="cypress" />

export {};

const PAGE_NAME = 'LandingPage';

describe(PAGE_NAME, () => {
    it('should load successfully', () => {
        cy.visit('/');
    });

    it('should change the viewport property', () => {
        // md breakpoint is at 900px
        cy.visit('/').viewport(899, 750);
        cy.get('[data-testid="MenuIcon"]').should('be.visible');
        cy.contains('STUDIES').should('not.be.visible');
        cy.contains('STUDYSETS').should('not.be.visible');
        cy.contains('META-ANALYSES').should('not.be.visible');
    });
});
