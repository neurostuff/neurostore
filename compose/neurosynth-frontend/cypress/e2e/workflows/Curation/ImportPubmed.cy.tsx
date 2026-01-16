/// <reference types="cypress" />

describe('ImportPubmedDialog', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'projects/projectExtractionStep',
        }).as('projectFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
    });

    describe('Import via Pubmed IDs', () => {
        beforeEach(() => {
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            // not going to mock this for now as cypress does not seem to support XML fixtures
            // cy.intercept('POST', 'https://eutils.ncbi.nlm.nih.gov/**', {
            //     fixture: 'NIHPMIDResponse',
            // }).as('NIHPMIDFixture.xml');

            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/efetchSingleResponse.xml',
                delay: 500,
            }).as('pmidsFetch');

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');

            cy.contains('button', 'import studies').click();
            cy.contains(/PMID/).click();
            cy.contains('button', 'next').click();
        });

        it('should show the pmid input page', () => {
            cy.get('textarea[placeholder="Enter list of pubmed IDs separated by a newline"]').should('be.visible');
        });

        it('should be disabled initially', () => {
            cy.contains('button', 'next').should('be.disabled');
        });

        it('should be enabled when an input is entered', () => {
            cy.get('textarea[placeholder="Enter list of pubmed IDs separated by a newline"]')
                .click()
                .type('123{enter}456{enter}789');
            cy.contains('button', 'next').should('not.be.disabled');
        });

        it('should show invalid for invalid input', () => {
            cy.get('textarea[placeholder="Enter list of pubmed IDs separated by a newline"]')
                .click()
                .type('123{enter}456{enter}789A');
            cy.contains(/format is incorrect/);
            cy.contains('button', 'next').should('be.disabled');
        });

        it('should import studies', () => {
            cy.get('textarea[placeholder="Enter list of pubmed IDs separated by a newline"]')
                .click()
                .type('123{enter}456{enter}789');
            cy.contains('button', 'next').click();
            cy.get('input').type('my new import{enter}');
            cy.contains('button', 'next').click().url().should('include', '/projects/abc123/curation');
        });

        it('should import studies via a file', () => {
            cy.get('label[role="button"]').selectFile('cypress/fixtures/pmids.txt');
            cy.contains('button', 'next').should('not.be.disabled');
        });
    });
});
