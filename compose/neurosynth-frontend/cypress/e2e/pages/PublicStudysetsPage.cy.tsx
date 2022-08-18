/// <reference types="cypress" />

import { mockStudysets } from 'testing/mockData';

export {};

const PATH = '/studysets';
const PAGE_NAME = 'PublicStudysetsPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
    });

    it('should load successfully', () => {
        cy.intercept('GET', `**/api/studysets/**`).as('realStudysetRequest');
        cy.login('real').visit(PATH).wait(['@realStudysetRequest', '@realStudysetRequest']);
    });

    describe('Tour ', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/studysets/**`, { results: mockStudysets() }).as(
                'studysetFixture'
            );
        });

        it('should open immediately if it is the users first time logging in', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 1 })
                .visit(PATH)
                .wait(['@studysetFixture', '@studysetFixture'])
                .get('.reactour__popover')
                .should('exist')
                .and('be.visible');
        });

        it('should not open immediately if not authenticated', () => {
            cy.visit(PATH).wait('@studysetFixture').get('.reactour__popover').should('not.exist');
        });

        it('should not open immediately if it is not the first time logging in', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .visit(PATH)
                .wait(['@studysetFixture', '@studysetFixture'])
                .get('.reactour__popover')
                .should('not.exist');
        });

        it('should open when the button is clicked', () => {
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .visit(PATH)
                .wait(['@studysetFixture', '@studysetFixture'])
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
                .wait(['@studysetFixture', '@studysetFixture'])
                .get('.reactour__popover')
                .should('not.exist');
        });

        it('should close when clicked out', () => {
            // 1. ARRANGE
            cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
                .visit(PATH)
                .wait(['@studysetFixture', '@studysetFixture'])
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
                .wait(['@studysetFixture', '@studysetFixture'])
                .get('[data-testid="HelpIcon"]')
                .click()
                .get('[aria-label="Close Tour"]')
                .click()
                .get('.react__popover')
                .should('not.exist');
        });
    });
});
