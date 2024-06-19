/// <reference types="cypress" />

import { mockStudies } from 'testing/mockData';

export {};

const PATH = '/base-studies';
const PAGE_NAME = 'StudiesPage';

describe.skip(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
    });

    it('should load successfully', () => {
        cy.intercept('GET', `**/api/projects*`).as('realProjectsRequest');
        cy.intercept('GET', `**/api/base-studies/**`).as('realStudiesRequest');
        cy.visit(PATH).wait('@realStudiesRequest');
    });

    // describe('Search', () => {
    //     beforeEach(() => {
    //         cy.intercept('GET', `**/api/studies/*`, {
    //             metadata: { total_count: 1000, unique_count: 1000 },
    //             results: [...mockStudies()],
    //         }).as('studiesRequest');
    //     });

    //     it.only('should make a correct request after selecting a different page of results', () => {
    //         cy.login('mocked');
    //         cy.wait('@studiesRequest');
    //         // ARRANGE
    //         cy.visit(PATH);
    //         cy.wait('@studiesRequest');
    //         // ACT
    //         cy.contains('button', '5').click().click();
    //         // ASSERT
    //         cy.wait('@studiesRequest').its('request.url').should('contain', 'page=5');
    //     });

    //     it('should make a correct request when selecting a different number of items to display on a single page', () => {
    //         cy.login('mocked')
    //             // ARRANGE
    //             .wait('@studiesRequest')
    //             .visit(PATH)
    //             .wait('@studiesRequest')
    //             .get('body')
    //             .contains('Rows per page')
    //             .siblings()
    //             .eq(1)
    //             // ACT
    //             .click()
    //             .get('[role="option"]')
    //             .contains('99')
    //             .click()
    //             // ASSERT
    //             .wait('@studiesRequest')
    //             .its('request.url')
    //             .should('contain', 'page_size=99');
    //     });

    //     it('should make a correct request when searching via the "All" option', () => {
    //         cy.login('mocked')
    //             // ARRANGE
    //             .wait('@studiesRequest')
    //             .visit(PATH)
    //             .wait('@studiesRequest')
    //             .get('input')
    //             .eq(1)
    //             // ACT
    //             .type('abcdefg{enter}')
    //             .wait('@studiesRequest')
    //             .its('request.url')
    //             .should('contain', 'search=abcdefg');
    //     });

    //     it('should make a correct request when searching via the "Title" option', () => {
    //         cy.login('mocked')
    //             // ARRANGE
    //             .wait('@studiesRequest')
    //             .visit(PATH)
    //             .wait('@studiesRequest')
    //             .get('body')
    //             .contains('All')
    //             // ACT
    //             .click()
    //             .get('[role="option"]')
    //             .contains('Title')
    //             .click()
    //             .get('input')
    //             .eq(1)
    //             // ASSERT
    //             .type('abcdefg{enter}')
    //             .wait('@studiesRequest')
    //             .its('request.url')
    //             .should('contain', 'name=abcdefg');
    //     });

    //     it('should make a correct request when searching via the "Authors" option', () => {
    //         cy.login('mocked')
    //             // ARRANGE
    //             .wait('@studiesRequest')
    //             .visit(PATH)
    //             .wait('@studiesRequest')
    //             .get('body')
    //             .contains('All')
    //             // ACT
    //             .click()
    //             .get('[role="option"]')
    //             .contains('Authors')
    //             .click()
    //             .get('input')
    //             .eq(1)
    //             // ASSERT
    //             .type('abcdefg{enter}')
    //             .wait('@studiesRequest')
    //             .its('request.url')
    //             .should('contain', 'authors=abcdefg');
    //     });

    //     it('should make a correct request when searching via the "Description" option', () => {
    //         cy.login('mocked')
    //             // ARRANGE
    //             .wait('@studiesRequest')
    //             .visit(PATH)
    //             .wait('@studiesRequest')
    //             .get('body')
    //             .contains('All')
    //             // ACT
    //             .click()
    //             .get('[role="option"]')
    //             .contains('Description')
    //             .click()
    //             .get('input')
    //             .eq(1)
    //             // ASSERT
    //             .type('abcdefg{enter}')
    //             .wait('@studiesRequest')
    //             .its('request.url')
    //             .should('contain', 'description=abcdefg');
    //     });
    // });

    // describe('Tour ', () => {
    //     beforeEach(() => {
    //         cy.intercept('GET', `**/api/studies/*`, { results: mockStudies() }).as(
    //             'studiesRequest'
    //         );
    //     });

    //     it('should open immediately if it is the users first time logging in', () => {
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 1 })
    //             .visit(PATH)
    //             .wait(['@studiesRequest', '@studiesRequest'])
    //             .get('.reactour__popover')
    //             .should('exist')
    //             .and('be.visible');
    //     });

    //     it('should not open immediately if not authenticated', () => {
    //         cy.visit(PATH).wait('@studiesRequest').get('.reactour__popover').should('not.exist');
    //     });

    //     it('should not open immediately if it is not the first time logging in', () => {
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
    //             .visit(PATH)
    //             .wait(['@studiesRequest', '@studiesRequest'])
    //             .get('.reactour__popover')
    //             .should('not.exist');
    //     });

    //     it('should open when the button is clicked', () => {
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
    //             .visit(PATH)
    //             .wait(['@studiesRequest', '@studiesRequest'])
    //             .get('[data-testid="HelpIcon"]')
    //             .click()
    //             .get('.reactour__popover')
    //             .should('exist')
    //             .and('be.visible');
    //     });

    //     it('should not open if its the first time logging in but the page has been seen already', () => {
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 1 })
    //             .get('body')
    //             .click(0, 0)
    //             .addToLocalStorage(`hasSeen${PAGE_NAME}`, 'true')
    //             .visit(PATH)
    //             .wait(['@studiesRequest', '@studiesRequest'])
    //             .get('.reactour__popover')
    //             .should('not.exist');
    //     });

    //     it('should close when clicked out', () => {
    //         // 1. ARRANGE
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
    //             .visit(PATH)
    //             .wait(['@studiesRequest', '@studiesRequest'])
    //             .get('[data-testid="HelpIcon"]')
    //             .click()
    //             .get('body')
    //             .click(0, 0)
    //             .get('.reactour__popover')
    //             .should('not.exist');
    //     });

    //     it('should close when the close button is clicked', () => {
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
    //             .visit(PATH)
    //             .wait(['@studiesRequest', '@studiesRequest'])
    //             .get('[data-testid="HelpIcon"]')
    //             .click()
    //             .get('[aria-label="Close Tour"]')
    //             .click()
    //             .get('.react__popover')
    //             .should('not.exist');
    //     });
    // });
});
