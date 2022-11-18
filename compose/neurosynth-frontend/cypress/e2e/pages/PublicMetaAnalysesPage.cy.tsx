/// <reference types="cypress" />

import { mockMetaAnalyses } from 'testing/mockData';

export {};

const PATH = '/meta-analyses';
const PAGE_NAME = 'MetaAnalysesPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
    });

    it('should load successfully', () => {
        cy.intercept('GET', `**/api/meta-analyses*`).as('realMetaAnalysesRequest');
        cy.login('real')
            .wait('@realMetaAnalysesRequest')
            .visit(PATH)
            .wait('@realMetaAnalysesRequest');
    });

    describe('Tour ', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/meta-analyses*`, { results: mockMetaAnalyses() }).as(
                'metaAnalysesRequest'
            );
        });
        it('should open immediately if it is the users first time logging in', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 1 })
                .wait('@metaAnalysesRequest')
                .visit(PATH)
                .wait('@metaAnalysesRequest')
                .get('.reactour__popover')
                .should('exist')
                .and('be.visible');
        });

        it('should not open immediately if not authenticated', () => {
            cy.visit(PATH)
                .wait('@metaAnalysesRequest')
                .get('.reactour__popover')
                .should('not.exist');
        });

        it('should not open immediately if it is not the first time logging in', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .wait('@metaAnalysesRequest')
                .visit(PATH)
                .wait('@metaAnalysesRequest')
                .get('.reactour__popover')
                .should('not.exist');
        });

        it('should open when the button is clicked', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .visit(PATH)
                .wait(['@metaAnalysesRequest', '@metaAnalysesRequest'])
                .get('[data-testid="HelpIcon"]')
                .click()
                .get('.reactour__popover')
                .should('exist')
                .and('be.visible');
        });

        it('should not open if its the first time logging in but the page has been seen already', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 1 })
                .get('body')
                .click(0, 0)
                .addToLocalStorage(`hasSeen${PAGE_NAME}`, 'true')
                .visit(PATH)
                .wait(['@metaAnalysesRequest', '@metaAnalysesRequest']);

            cy.get('.reactour__popover').should('not.exist');
        });

        it('should close when clicked out', () => {
            // 1. ARRANGE
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .visit(PATH)
                .wait(['@metaAnalysesRequest', '@metaAnalysesRequest'])
                .get('[data-testid="HelpIcon"]')
                .click()
                .get('body')
                .click(0, 0)
                .get('.reactour__popover')
                .should('not.exist');
        });

        it('should close when the close button is clicked', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .visit(PATH)
                .wait(['@metaAnalysesRequest', '@metaAnalysesRequest'])
                .get('[data-testid="HelpIcon"]')
                .click()
                .get('[aria-label="Close Tour"]')
                .click()
                .get('.react__popover')
                .should('not.exist');
        });
    });
});
