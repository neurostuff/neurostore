/// <reference types="cypress" />

export {};

const _PATH = '/';
const PAGE_NAME = 'AuthenticatedLandingPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
    });

    it('should load successfully', () => {
        cy.login('real', { 'https://neurosynth-compose/loginsCount': 1 });
    });

    describe('Tour ', () => {
        it('should open immediately if it is the users first time logging in', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 1 })
                .get('.reactour__popover')
                .should('exist')
                .and('be.visible');
        });

        it('should not open immediately if it is not the first time logging in', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .get('.reactour__popover')
                .should('not.exist');
        });

        it('should open when the button is clicked', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
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
                .visit('/')
                .get('.reactour__popover')
                .should('not.exist');
        });

        it('should close when clicked out', () => {
            // 1. ARRANGE
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .get('[data-testid="HelpIcon"]')
                .click()
                .get('body')
                .click(0, 0)
                .get('.reactour__popover')
                .should('not.exist');
        });

        it('should close when the close button is clicked', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .get('[data-testid="HelpIcon"]')
                .click()
                .get('[aria-label="Close Tour"]')
                .click()
                .get('.reactour__popover')
                .should('not.exist');
        });
    });
});
