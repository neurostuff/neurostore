/// <reference types="cypress" />

export {};

const PATH = '/projects/abc123/extraction/studies/mock-study-id';
const PAGE_NAME = 'EditStudyPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `https://api.semanticscholar.org/**`, {
            fixture: 'semanticScholar',
        }).as('semanticScholarFixture');
    });

    it('should load', () => {
        cy.intercept('GET', `**/api/studies/mock-study-id*`, { fixture: 'study' }).as(
            'studyFixture'
        );
        cy.intercept('GET', `**/api/projects/*`, { fixture: 'projects/project' }).as(
            'projectFixture'
        );
        cy.intercept('GET', `**/api/annotations/*`, { fixture: 'annotation' }).as(
            'annotationFixture'
        );
        cy.visit(PATH)
            .wait('@studyFixture')
            .wait('@projectFixture')
            .wait('@annotationFixture')
            .wait('@semanticScholarFixture');
        // cy.login('mocked').wait('@realProjectsRequest').visit(PATH).wait('@studyFixture');
    });

    // it('should redirect if the user is not authenticated', () => {
    //     cy.intercept('GET', `**/api/studies/mock-study-id*`, { fixture: 'study' }).as(
    //         'studyFixture'
    //     );
    //     cy.visit(PATH)
    //         .wait(['@studyFixture']) // request made twice as the first time, once for the edit page and again for the study page
    //         .url()
    //         .should('be.equal', `${Cypress.config('baseUrl')}/studies/mock-study-id`);
    // });

    // TODO:
    // it('should switch to the second last tab if the selected analysis is last and gets deleted', () => {

    // });
});
