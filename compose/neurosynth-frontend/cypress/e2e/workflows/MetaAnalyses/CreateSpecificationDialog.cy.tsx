/// <reference types="cypress" />

describe('CreateSpecificationDialog', () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/meta-analyses*`, { fixture: 'metaAnalyses' }).as(
            'metaAnalysesFixture'
        );
        cy.intercept('GET', '**/api/meta-analysis-results/**', {
            fixture: 'metaAnalysisResults',
        }).as('metaAnalysisResultsFixture');
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'projects/projectCanCreateSpecification',
        }).as('projectFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
    });

    it('should show the dialog', () => {
        cy.login('mocked', { sub: 'github|26612023' })
            .visit('/projects/abc123')
            .wait('@projectFixture');
        cy.contains('button', 'Meta-Analyses').click();
        cy.contains('button', 'Meta-Analysis Specification').click();
        cy.get('.MuiDialog-container').should('be.visible');
    });
});
