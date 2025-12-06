/// <reference types="cypress" />

const PATH = '/projects/mock-project-id/curation';

describe('Ingestion', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/meta-analyses*`, { fixture: 'metaAnalyses' }).as('metaAnalysesFixture');

        cy.intercept('POST', `https://www.google-analytics.com/*/**`, {}).as('googleAnalyticsFixture');

        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'IngestionFixtures/projectFixture',
        }).as('projectFixture');
        cy.intercept('PUT', `**/api/projects/*`, {
            fixture: 'IngestionFixtures/projectPutFixture',
        });

        cy.intercept('POST', `**/api/studysets/`, {
            fixture: 'IngestionFixtures/studysetFixture',
        }).as('studysetFixture');
        cy.intercept('PUT', `**/api/studysets/*`, {
            fixture: 'IngestionFixtures/studysetPutFixture',
        });
        cy.intercept('GET', `**/api/studysets/*`, {
            fixture: 'IngestionFixtures/studysetFixture',
        }).as('studysetFixture');

        cy.intercept('POST', `**/api/annotations/**`, {
            fixture: 'IngestionFixtures/annotationsFixture',
        }).as('annotationFixture');
        cy.intercept('PUT', `**/api/annotations/**`, {
            fixture: 'IngestionFixtures/annotationsPutFixture',
        }).as('annotationPutFixture');
        cy.intercept('GET', `**/api/annotations/**`, {
            fixture: 'IngestionFixtures/annotationsPutFixture',
        }).as('annotationFixture');

        cy.intercept('POST', `**/api/base-studies*`, {
            fixture: 'IngestionFixtures/baseStudiesFixture',
        }).as('baseStudiesFixture');
    });

    it('should show the dialog', () => {
        cy.login('mocked').visit(PATH);
        cy.contains('button', 'start extraction').click(); // popup should open automatically as extraction has not been initialized in this mock
        cy.contains('button', 'NEXT').click();
        cy.contains('button', 'START').click();

        cy.wait('@baseStudiesFixture')
            .its('request.body')
            .should('not.have.a.property', 'doi')
            .and('not.have.a.property', 'pmid')
            .and('not.have.a.property', 'pmcid');
    });
});
