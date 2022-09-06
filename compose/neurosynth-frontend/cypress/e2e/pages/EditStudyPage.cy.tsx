/// <reference types="cypress" />

export {};

const PATH = '/studies/mock-study-id/edit';
const PAGE_NAME = 'EditStudyPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
    });

    it('should load', () => {
        cy.intercept('GET', `**/api/studies/mock-study-id*`, { fixture: 'study' }).as(
            'studyFixture'
        );
        cy.login('mocked').visit(PATH).wait('@studyFixture');
    });

    it('should redirect if the user is not authenticated', () => {
        cy.intercept('GET', `**/api/studies/mock-study-id*`, { fixture: 'study' }).as(
            'studyFixture'
        );
        cy.visit(PATH)
            .wait(['@studyFixture']) // request made twice as the first time, once for the edit page and again for the study page
            .url()
            .should('be.equal', `${Cypress.config('baseUrl')}/studies/mock-study-id`);
    });
});