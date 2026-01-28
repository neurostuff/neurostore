/// <reference types="cypress" />

describe('ImportManualCreateDialog', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'projects/projectExtractionStep',
        }).as('projectFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
    });

    describe('Manually create a new study', () => {
        beforeEach(() => {
            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            cy.contains('button', 'import studies').click();
            cy.contains('Manually create a new study').click();
            cy.contains('button', 'next').click();
        });

        it('should show the create new study page', () => {
            cy.contains('label', 'Study Name *').should('be.visible');
            cy.contains('label', 'Authors').should('be.visible');
            cy.contains('label', 'DOI').should('be.visible');
            cy.contains('label', 'Journal').should('be.visible');
            cy.contains('label', 'PubMed ID').should('be.visible');
            cy.contains('label', 'PubMed Central ID').should('be.visible');
            cy.contains('label', 'Article Year').should('be.visible');
            cy.contains('label', 'article link').should('be.visible');
            cy.contains('label', 'Keywords').should('be.visible');
            cy.contains('label', 'select study data source *').should('be.visible');
        });

        it('should be disabled initially', () => {
            cy.contains('button', 'next').should('be.disabled');
        });

        it('should be enabled when name and source are entered', () => {
            cy.get('input[placeholder="My study name"]').click().type('new study');
            cy.get('input[role="combobox"]').click();
            cy.contains('li', 'Neurostore').click();
            cy.get('input[placeholder="10.1016/S0896-6273(00)80715-1"]').click().type('10.1000/test');
            cy.get('input[placeholder="21706013"]').click().type('12345678');
            cy.contains('button', 'next').should('not.be.disabled');
        });

        it('should import studies', () => {
            cy.get('input[placeholder="My study name"]').click().type('new study');
            cy.get('input[role="combobox"]').click();
            cy.contains('li', 'Neurostore').click();
            cy.get('input[placeholder="10.1016/S0896-6273(00)80715-1"]').click().type('10.1000/test');
            cy.get('input[placeholder="21706013"]').click().type('12345678');
            cy.contains('button', 'next').click();
            cy.get('input').type('my new import{enter}');
            cy.contains('button', 'next').click().url().should('include', '/projects/abc123/curation');
        });

        it('should confirm when no identifiers are provided', () => {
            cy.get('input[placeholder="My study name"]').click().type('new study');
            cy.get('input[role="combobox"]').click();
            cy.contains('li', 'Neurostore').click();
            cy.contains('label', 'No DOI').click();
            cy.contains('label', 'No PMID').click();
            cy.contains('button', 'next').click();
            cy.contains('No identifiers provided').should('be.visible');
            cy.contains('button', 'Continue').click();
            cy.get('input').type('my new import{enter}');
            cy.contains('button', 'next').click().url().should('include', '/projects/abc123/curation');
        });
    });
});
