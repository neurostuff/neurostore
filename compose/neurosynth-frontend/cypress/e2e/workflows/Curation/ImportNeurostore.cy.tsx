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

    describe('Search Neurostore', () => {
        beforeEach(() => {
            cy.login('mocked').visit('/projects/abc123/curation');
            cy.intercept('GET', '**/api/base-studies/**', {
                fixture: 'baseStudies/baseStudiesWithResults',
            }).as('baseStudiesFixture');
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            cy.visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');
            cy.contains('button', 'import studies').click();
            cy.contains('button', 'next').click();
        });

        it('should show the neurostore search page', () => {
            // we can target the table as the neurostore search is the only table HTML that appears in this workflow
            cy.get('.MuiTableContainer-root').should('be.visible');
        });

        it('should be disabled initially', () => {
            cy.wait('@baseStudiesFixture').then((baseStudiesResponse) => {
                cy.contains(
                    'button',
                    `Import ${baseStudiesResponse.response?.body?.results?.length} studies from neurostore`
                ).should('be.disabled');
            });
        });

        it('should import studies', () => {
            cy.get('input[type="text"]').type('neuron');
            cy.get('button').contains('Search').click();
            cy.wait('@baseStudiesFixture').then((baseStudiesResponse) => {
                cy.contains(
                    'button',
                    `Import ${baseStudiesResponse.response?.body?.results?.length} studies from neurostore`
                ).click();
            });
            cy.get('input').type('my new import{enter}');
            cy.contains('button', 'next').click().url().should('include', '/projects/abc123/curation');
        });
    });
});
