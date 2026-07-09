/// <reference types="cypress" />

export {};

const PATH = '/projects/abc123/meta-analyses/mock-meta-analysis-id';
const PAGE_NAME = 'ProjectMetaAnalysesPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
            'specificationFixture'
        );
        cy.intercept('GET', `**/api/meta-analyses/**`, { fixture: 'MetaAnalysis/metaAnalysis' }).as(
            'metaAnalysisFixture'
        );
        cy.fixture('projects/project').then((project) => {
            project.public = true;
            cy.intercept('GET', `**/api/projects/*`, project).as('projectFixture');
        });
        cy.intercept('GET', `**/api/annotations/*`, { fixture: 'annotation' }).as('annotationFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
        cy.intercept('GET', `**/api/meta-analysis-jobs`, { fixture: 'MetaAnalysis/jobs/noJobs' }).as('jobsFixture');
    });

    it('should load successfully', () => {
        cy.login('mocked').visit(PATH).wait('@metaAnalysisFixture').wait('@projectFixture');
    });

    // describe('Tour ', () => {
    //     beforeEach(() => {
    //         cy.intercept('GET', `**/api/meta-analyses*`, { results: mockMetaAnalyses() }).as(
    //             'metaAnalysesRequest'
    //         );
    //     });
    //     it('should open immediately if it is the users first time logging in', () => {
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 1 })
    //             .wait('@metaAnalysesRequest')
    //             .visit(PATH)
    //             .wait('@metaAnalysesRequest')
    //             .get('.reactour__popover')
    //             .should('exist')
    //             .and('be.visible');
    //     });

    //     it('should not open immediately if not authenticated', () => {
    //         cy.visit(PATH)
    //             .wait('@metaAnalysesRequest')
    //             .get('.reactour__popover')
    //             .should('not.exist');
    //     });

    //     it('should not open immediately if it is not the first time logging in', () => {
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
    //             .wait('@metaAnalysesRequest')
    //             .visit(PATH)
    //             .wait('@metaAnalysesRequest')
    //             .get('.reactour__popover')
    //             .should('not.exist');
    //     });

    //     it('should open when the button is clicked', () => {
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
    //             .visit(PATH)
    //             .wait(['@metaAnalysesRequest', '@metaAnalysesRequest'])
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
    //             .wait(['@metaAnalysesRequest', '@metaAnalysesRequest']);

    //         cy.get('.reactour__popover').should('not.exist');
    //     });

    //     it('should close when clicked out', () => {
    //         // 1. ARRANGE
    //         cy.login('mocked', { 'https://neurosynth-compose/loginsCount': 2 })
    //             .visit(PATH)
    //             .wait(['@metaAnalysesRequest', '@metaAnalysesRequest'])
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
    //             .wait(['@metaAnalysesRequest', '@metaAnalysesRequest'])
    //             .get('[data-testid="HelpIcon"]')
    //             .click()
    //             .get('[aria-label="Close Tour"]')
    //             .click()
    //             .get('.react__popover')
    //             .should('not.exist');
    //     });
    // });
});
