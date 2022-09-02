/// <reference types="cypress" />

import { mockAnnotations } from 'testing/mockData';

export {};

const PATH = '/studysets/mock-studyset-id';
const PAGE_NAME = 'StudysetPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
    });

    /**
     * Currently the DB is not seeded with actual studies or studysets so this may fail
     */
    // it('should load successfully', () => {
    //     cy.intercept('GET', '**/studysets/*').as('realStudysetsRequest');
    //     cy.login('real')
    //         .visit('/studysets')
    //         .wait('@realStudysetsRequest')
    //         .get('tr')
    //         .eq(1)
    //         .click()
    //         .wait('@realStudysetsRequest');
    // });

    describe('Tour ', () => {
        beforeEach(() => {
            cy.intercept('GET', '**/api/studysets/mock-studyset-id*', { fixture: 'studyset' }).as(
                'studysetFixture'
            );

            cy.intercept('GET', '**/api/annotations/*', { results: mockAnnotations() }).as(
                'annotationsRequest'
            );
        });

        it('should open immediately if it is the users first time logging in', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 1 })
                .visit(PATH)
                .wait(['@studysetFixture', '@annotationsRequest'])
                .get('.reactour__popover')
                .should('exist')
                .and('be.visible');
        });

        it('should not open immediately if it is not the first time logging in', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .visit(PATH)
                .wait(['@studysetFixture', '@annotationsRequest'])
                .then(() => {
                    cy.get('.reactour__popover').should('not.exist');
                });
        });

        it('should open when the button is clicked', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .visit(PATH)
                .wait(['@studysetFixture', '@annotationsRequest'])
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
                .wait(['@studysetFixture', '@annotationsRequest'])
                .get('.reactour__popover')
                .should('not.exist');
        });

        it('should close when clicked out', () => {
            // 1. ARRANGE
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .visit(PATH)
                .wait(['@studysetFixture', '@annotationsRequest'])
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
                .wait(['@studysetFixture', '@annotationsRequest'])
                .get('[data-testid="HelpIcon"]')
                .click()
                .get('[aria-label="Close Tour"]')
                .click()
                .get('.react__popover')
                .should('not.exist');
        });
    });
});
