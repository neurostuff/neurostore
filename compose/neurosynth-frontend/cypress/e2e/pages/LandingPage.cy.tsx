/// <reference types="cypress" />

export {};

const PAGE_NAME = 'LandingPage';

describe(PAGE_NAME, () => {
    it('should load successfully', () => {
        cy.visit('/');
    });
});
