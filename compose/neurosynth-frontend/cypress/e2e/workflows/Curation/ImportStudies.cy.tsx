/// <reference types="cypress" />

/** Modern curation UI: fixtures keep columns empty, so the empty-state Search control is always shown. */
const visitCuration = () => {
    cy.visit('/projects/abc123/curation').wait('@projectFixture');
};

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
        cy.login('mocked');
        visitCuration();
        cy.url().should('include', '/projects/abc123/curation');
    });

    it('should open the curation search page when clicking Search button', () => {
        cy.login('mocked');
        visitCuration();
        cy.contains('button', 'Search').click();
        cy.url().should('include', '/projects/abc123/curation/search');
        cy.url().should('include', 'dataType=coordinate');
        cy.contains('Search Neurostore').should('be.visible');
    });

    it('should use image datatype when opening search from an IBMA project', () => {
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'projects/projectExtractionStepIBMA',
        }).as('projectIBMAFixture');
        cy.login('mocked');
        cy.visit('/projects/abc123/curation').wait('@projectIBMAFixture');
        cy.contains('button', 'Search').click();
        cy.url().should('include', '/projects/abc123/curation/search');
        cy.url().should('include', 'dataType=image');
    });

    it('should open the import dialog when selecting an option from the dropdown', () => {
        cy.login('mocked');
        visitCuration();
        cy.contains('button', 'Import Studies').click();
        cy.contains('li', 'Import via Pubmed ID').click();
        cy.contains('Import Studies').should('be.visible');
        cy.get('textarea[placeholder="Enter list of pubmed IDs separated by a newline"]').should('be.visible');
    });

    describe('Finalize Import', () => {
        beforeEach(() => {
            cy.intercept('GET', '**/api/base-studies/**', {
                fixture: 'baseStudies/baseStudiesWithResults',
            }).as('baseStudiesFixture');
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            cy.login('mocked');
            visitCuration();
            cy.contains('button', 'Search').click();
            cy.url().should('include', '/projects/abc123/curation/search');
        });

        it('should enter the import name based on the search and typed text', () => {
            cy.get('input[type="text"]').first().type('neuron');
            cy.get('button').contains('Search').click();
            cy.wait('@baseStudiesFixture');
            cy.contains('button', `next`).should('not.be.disabled');
            cy.get('input[type="text"]').first().type(' (my import)');
            cy.get('input[type="text"]').first().should('have.value', 'neuron (my import)');
            cy.contains('button', 'next').should('not.be.disabled');
        });
    });
});
