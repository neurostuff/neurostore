/// <reference types="cypress" />

export {};

const PATH = '/projects/abc123';
const PAGE_NAME = 'ProjectPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/meta-analyses*`, { fixture: 'metaAnalyses' }).as(
            'metaAnalysesFixture'
        );
        cy.intercept('GET', `**/api/projects/*`, { fixture: 'projects/projectExtractionStep' }).as(
            'projectFixture'
        );
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
    });

    it('should load successfully', () => {
        cy.visit(PATH).wait('@metaAnalysesFixture').wait('@projectFixture');
    });
});
