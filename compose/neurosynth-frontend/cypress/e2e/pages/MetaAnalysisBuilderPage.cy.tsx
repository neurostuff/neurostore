/// <reference types="cypress" />

import { mockMetaAnalyses } from 'testing/mockData';

export {};

const PATH = '/meta-analyses/build';
const PAGE_NAME = 'MetaAnalysisBuilderPage';

/// <reference types="cypress" />

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
    });

    it('should load successfully', () => {
        cy.login('real').visit(PATH);
    });

    it('should redirect if the user is not authenticated', () => {
        cy.intercept('GET', `**/meta-analyses*`, { results: mockMetaAnalyses() });
        cy.visit(PATH)
            .url()
            .should('be.equal', `${Cypress.config('baseUrl')}/meta-analyses`);
    });

    it.only('should redirect to the meta-analysis builder page from the navbar', () => {
        cy.login('mocked')
            .get('button')
            .contains('META-ANALYSES')
            .click()
            .get('a')
            .contains('Create New Meta-Analysis')
            .click()
            .url()
            .should('be.equal', `${Cypress.config('baseUrl')}/meta-analyses/build`);
    });

    describe('Tour ', () => {
        it('should open immediately if it is the users first time logging in', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 1 })
                .visit(PATH)
                .get('.reactour__popover')
                .should('exist')
                .and('be.visible');
        });

        it('should not open immediately if not authenticated', () => {
            cy.visit(PATH).get('.reactour__popover').should('not.exist');
        });

        it('should not open immediately if it is not the first time logging in', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .visit(PATH)
                .get('.reactour__popover')
                .should('not.exist');
        });

        it('should open when the button is clicked', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .visit(PATH)
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
                .then((_res) => {
                    localStorage.setItem(`hasSeen${PAGE_NAME}`, 'true');
                })
                .visit(PATH)
                .get('.reactour__popover')
                .should('not.exist');
        });

        it('should close when clicked out', () => {
            // 1. ARRANGE
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .visit(PATH)
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
                .get('[data-testid="HelpIcon"]')
                .click()
                .get('[aria-label="Close Tour"]')
                .click()
                .get('.react__popover')
                .should('not.exist');
        });
    });
});
