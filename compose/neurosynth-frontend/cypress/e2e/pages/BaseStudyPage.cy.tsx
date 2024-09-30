/// <reference types="cypress" />

export {};

const PATH = '/base-studies/mock-study-id';
const PAGE_NAME = 'BaseStudyPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', `https://api.semanticscholar.org/**`, {
            fixture: 'semanticScholar',
        }).as('semanticScholarFixture');
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
    });

    /**
     * Currently the DB is not seeded with actual studies so this may fail
     */
    it('should load successfully', () => {
        cy.intercept('GET', `**/api/projects*`).as('realProjectsRequest');
        cy.intercept('GET', `**/api/base-studies/**`, {
            fixture: 'study',
        }).as('studyFixture');
        cy.visit(PATH).wait('@semanticScholarFixture').wait('@studyFixture');
        // .get('tr')
        // .eq(2)
        // .click()
        // .wait('@realStudyFixture');
    });

    // describe('Cloning', () => {
    //     it('should show a confirmation dialog if you have already cloned the study', () => {
    //         cy.intercept(
    //             'GET',
    //             `**/api/studies/mock-study-id*`,
    //             mockStudy({ user: 'auth0|62e0e6c9dd47048572613b4d' }) // mock a cloned study by replacing user with our test user
    //         ).as('studyFixture');

    //         cy.login('mocked')
    //             .visit(PATH)
    //             .wait('@studyFixture')
    //             .get('body')
    //             .contains('Clone Study')
    //             .click()
    //             .get('[role="dialog"]')
    //             .should('be.visible');
    //     });

    //     it('should not show the confirmation dialog and directly clone the study', () => {
    //         cy.intercept(
    //             'GET',
    //             `**/api/studies/**`,
    //             mockStudy({ user: 'some-other-user' }) // mock a cloned study by replacing user with our test user
    //         ).as('studyFixture');

    //         cy.intercept('POST', '**/api/studies/**', { statusCode: 201 }).as('studyPostRequest');

    //         cy.login('mocked')
    //             .visit(PATH)
    //             .wait('@studyFixture')
    //             .get('body')
    //             .contains('Clone Study')
    //             .click()
    //             .get('[role="dialog"]')
    //             .should('not.exist');
    //     });
    // });

    // describe('Tour ', () => {
    //     beforeEach(() => {
    //         cy.intercept('GET', `**/api/studies/mock-study-id*`, { fixture: 'study' }).as(
    //             'studyFixture'
    //         );
    //     });

    //     it('should open immediately if it is the users first time logging in', () => {
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 1 })
    //             .visit(PATH)
    //             .wait('@studyFixture')
    //             .get('.reactour__popover')
    //             .should('exist')
    //             .and('be.visible');
    //     });

    //     it('should not open immediately if it is not the first time logging in', () => {
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
    //             .visit(PATH)
    //             .wait('@studyFixture')
    //             .then(() => {
    //                 cy.get('.reactour__popover').should('not.exist');
    //             });
    //     });

    //     it('should open when the button is clicked', () => {
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
    //             .visit(PATH)
    //             .wait('@studyFixture')
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
    //             .then((_res) => {
    //                 localStorage.setItem(`hasSeen${PAGE_NAME}`, 'true');
    //             })
    //             .visit(PATH)
    //             .wait('@studyFixture')
    //             .get('.reactour__popover')
    //             .should('not.exist');
    //     });

    //     it('should close when clicked out', () => {
    //         // 1. ARRANGE
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
    //             .visit(PATH)
    //             .wait('@studyFixture')
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
    //             .wait('@studyFixture')
    //             .get('[data-testid="HelpIcon"]')
    //             .click()
    //             .get('[aria-label="Close Tour"]')
    //             .click()
    //             .get('.react__popover')
    //             .should('not.exist');
    //     });
    // });
});
