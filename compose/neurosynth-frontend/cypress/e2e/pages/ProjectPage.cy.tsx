/// <reference types="cypress" />

export {};

const PATH = '/projects/abc123';
const PAGE_NAME = 'ProjectPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('POST', `https://www.google-analytics.com/*/**`, {}).as('googleAnalyticsFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
        cy.intercept('PUT', `**/api/projects/*`, { fixture: 'projects/projectPut' }).as('updateProjectFixture');
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'ProjectPage/projectAtExtraction',
        }).as('projectFixture');
    });

    it('should load successfully', () => {
        cy.visit(PATH).wait('@projectFixture');
    });

    it('should set the project from private to public when logged in and you own the project', () => {
        cy.login('mocked');
        cy.visit(PATH).wait('@projectFixture');
        cy.contains('button', 'Public').click();
        cy.wait('@updateProjectFixture').then((res) => {
            assert.exists(res.request.body.public);
            assert.isTrue(res.request.body.public);
        });
    });

    it('should set the project from public to private when logged in and you own the project', () => {
        cy.login('mocked');
        cy.fixture('ProjectPage/projectWithMetaAnalyses').then((projectFixture) => {
            projectFixture.public = true;
            cy.intercept('GET', `**/api/projects/*`, projectFixture).as('projectFixturePublic');
        });
        cy.visit(PATH).wait('@projectFixturePublic');
        cy.contains('button', 'Private').click();
        cy.wait('@updateProjectFixture').then((res) => {
            assert.exists(res.request.body.public);
            assert.isFalse(res.request.body.public);
        });
    });

    it('should show both tabs for projects that can access meta-analyses', () => {
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'ProjectPage/projectWithMetaAnalyses',
        }).as('projectFixture');
        cy.login('mocked');
        cy.visit(PATH).wait('@projectFixture');
        cy.get('button').contains('Project');
        cy.get('button').contains('Meta-Analyses');
    });

    it('should not show the meta-analyses tab if the project has not reached that step', () => {
        cy.login('mocked');
        cy.visit(PATH).wait('@projectFixture');
        cy.get('button').contains('Project');
        cy.get('button').should('not.contain', 'Meta-Analyses');
    });
});
