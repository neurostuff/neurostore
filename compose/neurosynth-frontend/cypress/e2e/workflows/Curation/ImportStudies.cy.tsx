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

    it('should load the page', () => {
        cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');
    });

    it('should open the curation search page when clicking Search button', () => {
        cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');
        cy.contains('button', 'Search').click();
        cy.url().should('include', '/projects/abc123/curation/search');
        cy.contains('Search Neurostore').should('be.visible');
    });

    it('should open the import page when selecting an option from the dropdown', () => {
        cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');
        // Open dropdown (the arrow button next to Search)
        cy.contains('button', 'Search').parent().find('button').last().click();
        cy.contains('li', 'Import via Pubmed ID').click();
        cy.url().should('include', '/projects/abc123/curation/import');
        cy.url().should('include', 'method=PUBMED_IMPORT');
        cy.contains('Import').should('be.visible');
    });

    describe('Finalize Import', () => {
        beforeEach(() => {
            cy.intercept('GET', '**/api/base-studies/**', {
                fixture: 'baseStudies/baseStudiesWithResults',
            }).as('baseStudiesFixture');
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            cy.login('mocked').visit('/projects/abc123/curation/search').wait('@projectFixture');
        });

        it('should enter the import name based on the search and typed text', () => {
            cy.get('input[type="text"]').first().type('neuron');
            cy.get('button').contains('Search').click();
            cy.wait('@baseStudiesFixture').then((baseStudiesResponse) => {
                cy.contains(
                    'button',
                    `Import ${baseStudiesResponse.response?.body?.results?.length} studies from neurostore`
                ).click();
            });
            cy.get('input[type="text"]').first().type(' (my import)');
            cy.get('input[type="text"]').first().should('have.value', 'neuron (my import)');
            cy.contains('button', 'next').should('not.be.disabled');
        });
    });
});
