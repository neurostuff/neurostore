/// <reference types="cypress" />

export {};

const PATH = '/projects/abc123/extraction/studies/mock-study-id/edit';
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
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
        cy.login('mocked').visit(PATH);
        cy.visit(PATH)
            .wait('@studyFixture')
            .wait('@projectFixture')
            .wait('@annotationFixture')
            .wait('@semanticScholarFixture')
            .wait('@studysetFixture');
    });
});
