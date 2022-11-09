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
        cy.login('real').wait('@realStudysetRequest').visit(PATH).wait('@realStudysetRequest');
    });

    describe('Search', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/studysets/**`, {
                metadata: { total_count: 1000, unique_count: 1000 },
                results: [...mockStudysets()],
            }).as('studysetsRequest');
        });

        it('should make a correct request after selecting a different page of results', () => {
            cy.login('mocked')
                // ARRANGE
                .wait('@studysetsRequest')
                .visit(PATH)
                .wait('@studysetsRequest')
                .get('button')
                .contains('5')
                // ACT
                .click()
                .click()
                .wait('@studysetsRequest')
                // ASSERT
                .its('request.url')
                .should('contain', 'page=5');
        });

        it('should make a correct request when selecting a different number of items to display on a single page', () => {
            cy.login('mocked')
                // ARRANGE
                .wait('@studysetsRequest')
                .visit(PATH)
                .wait('@studysetsRequest')
                .get('body')
                .contains('Rows per page')
                .siblings()
                .eq(1)
                // ACT
                .click()
                .get('[role="option"]')
                .contains('99')
                .click()
                // ASSERT
                .wait('@studysetsRequest')
                .its('request.url')
                .should('contain', 'page_size=99');
        });

        it('should make a correct request when searching via the "All" option', () => {
            cy.login('mocked')
                // ARRANGE
                .wait('@studysetsRequest')
                .visit(PATH)
                .wait('@studysetsRequest')
                .get('input')
                .eq(1)
                // ACT
                .type('abcdefg{enter}')
                .wait('@studysetsRequest')
                .its('request.url')
                .should('contain', 'search=abcdefg');
        });

        it('should make a correct request when searching via the "Title" option', () => {
            cy.login('mocked')
                // ARRANGE
                .wait('@studysetsRequest')
                .visit(PATH)
                .wait('@studysetsRequest')
                .get('body')
                .contains('All')
                // ACT
                .click()
                .get('[role="option"]')
                .contains('Title')
                .click()
                .get('input')
                .eq(1)
                // ASSERT
                .type('abcdefg{enter}')
                .wait('@studysetsRequest')
                .its('request.url')
                .should('contain', 'name=abcdefg');
        });

        it('should make a correct request when searching via the "Authors" option', () => {
            cy.login('mocked')
                // ARRANGE
                .wait('@studysetsRequest')
                .visit(PATH)
                .wait('@studysetsRequest')
                .get('body')
                .contains('All')
                // ACT
                .click()
                .get('[role="option"]')
                .contains('Authors')
                .click()
                .get('input')
                .eq(1)
                // ASSERT
                .type('abcdefg{enter}')
                .wait('@studysetsRequest')
                .its('request.url')
                .should('contain', 'authors=abcdefg');
        });

        it('should make a correct request when searching via the "Description" option', () => {
            cy.login('mocked')
                // ARRANGE
                .wait('@studysetsRequest')
                .visit(PATH)
                .wait('@studysetsRequest')
                .get('body')
                .contains('All')
                // ACT
                .click()
                .get('[role="option"]')
                .contains('Description')
                .click()
                .get('input')
                .eq(1)
                // ASSERT
                .type('abcdefg{enter}')
                .wait('@studysetsRequest')
                .its('request.url')
                .should('contain', 'description=abcdefg');
        });
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
