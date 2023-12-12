/// <reference types="cypress" />

describe('CreateSpecificationDialog', () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/meta-analyses*`, { fixture: 'metaAnalyses' }).as(
            'metaAnalysesFixture'
        );
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'projects/projectCanCreateSpecification',
        }).as('projectFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
    });

    it('should show the dialog', () => {
        cy.visit('/projects/abc123').wait('@projectFixture');
        cy.contains('button', 'View Meta-Analyses').click();
        cy.contains('button', 'Meta-Analysis Specification').click();
        cy.get('.MuiDialog-container').should('be.visible');
    });
});
