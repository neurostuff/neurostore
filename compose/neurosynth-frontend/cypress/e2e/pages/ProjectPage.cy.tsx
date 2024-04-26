/// <reference types="cypress" />

export {};

const PATH = '/projects/abc123';
const PAGE_NAME = 'ProjectPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
        cy.intercept('PUT', `**/api/projects/*`, { fixture: 'projects/projectPut' }).as(
            'updateProjectFixture'
        );
    });

    it('should load successfully', () => {
        cy.intercept('GET', `**/api/projects/*`, { fixture: 'projects/projectExtractionStep' }).as(
            'projectFixture'
        );
        cy.visit(PATH).wait('@projectFixture');
    });

    it.only('should set the project from private to public when logged in and you own the project', () => {
        cy.login('mocked');
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'projects/projectExtractionStep',
        }).as('projectFixture');
        cy.visit(PATH).wait('@projectFixture');
        cy.contains('button', 'Public').click();
        cy.wait('@updateProjectFixture').then((res) => {
            assert.exists(res.request.body.public);
            assert.isTrue(res.request.body.public);
        });
    });

    it('should set the project from public to private when logged in and you own the project', () => {
        cy.login('mocked');
        cy.fixture('projects/projectExtractionStep').then((projectFixture) => {
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
});
