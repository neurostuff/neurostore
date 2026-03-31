/// <reference types="cypress" />

describe('ImportStudiesDialog', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'projects/projectExtractionStep',
        }).as('projectFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');

        cy.addToLocalStorage('auth0|62e0e6c9dd47048572613b4d-hide-info-popup', 'true');
    });

    describe('Search Neurostore', () => {
        beforeEach(() => {
            cy.intercept('GET', '**/api/base-studies/**', {
                fixture: 'baseStudies/baseStudiesWithResults',
            }).as('baseStudiesFixture');
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');
            cy.contains('button', 'Search').click();
        });

        it('should show the neurostore search page', () => {
            // we can target the table as the neurostore search is the only table HTML that appears in this workflow
            cy.get('.MuiTableContainer-root').should('be.visible');
        });

        it('should be disabled initially', () => {
            cy.wait('@baseStudiesFixture');
            cy.contains('button', `next`).should('be.disabled');
        });

        it('should import studies', () => {
            cy.get('input[type="text"]').type('neuron');
            cy.get('button').contains('Search').click();
            cy.wait('@baseStudiesFixture');
            cy.contains('button', `next`).should('be.disabled');
            cy.get('input[type="text"]').first().clear().type('my new import');
            cy.url().should('include', '/projects/abc123/curation');
        });
    });
});
