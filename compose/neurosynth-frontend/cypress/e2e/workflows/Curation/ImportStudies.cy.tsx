/// <reference types="cypress" />

describe('ImportStudiesDialog', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'projects/projectExtractionStep',
        }).as('projectFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
    });

    it('should load the page', () => {
        cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');
    });

    it('should open the import studies page', () => {
        cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');
        cy.contains('button', 'import studies').click();
        cy.get('.MuiFormControl-root').should('be.visible');
        cy.url().should('include', '/projects/abc123/curation/import');
    });

    describe('Finalize Import', () => {
        beforeEach(() => {
            cy.intercept('GET', '**/api/base-studies/**', {
                fixture: 'baseStudies/baseStudiesWithResults',
            }).as('baseStudiesFixture');
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');
            cy.contains('button', 'import studies').click();
            cy.contains('button', 'next').click();
        });

        it('should enter the import name based on the search and typed text', () => {
            cy.get('input[type="text"]').type('neuron');
            cy.get('button').contains('Search').click();
            cy.wait('@baseStudiesFixture').then((baseStudiesResponse) => {
                cy.contains(
                    'button',
                    `Import ${baseStudiesResponse.response?.body?.results?.length} studies from neurostore`
                ).click();
            });
            cy.get('input[type="text"]').type(' (my import)');
            cy.should('have.value', 'neuron (my import)').click();
            cy.contains('button', 'next').should('not.be.disabled');
        });
    });
});
