/// <reference types="cypress" />

export {};

const PATH = '/meta-analyses/mock-meta-analysis-id';
const PAGE_NAME = 'MetaAnalysisPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/specifications/**`, { fixture: 'specification' }).as(
            'specificationFixture'
        );
        cy.intercept('GET', `**/api/meta-analyses/**`, { fixture: 'metaAnalysis' }).as(
            'metaAnalysisFixture'
        );
        cy.fixture('projects/project').then((project) => {
            project.public = true;
            cy.intercept('GET', `**/api/projects/*`, project).as('projectFixture');
        });
        cy.intercept('GET', `**/api/annotations/*`, { fixture: 'annotation' }).as(
            'annotationFixture'
        );
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
    });

    it('should load successfully', () => {
        cy.visit(PATH)
            .wait('@metaAnalysisFixture')
            .wait('@projectFixture')
            .wait('@specificationFixture')
            .wait('@annotationFixture')
            .wait('@studysetFixture');
    });
});
