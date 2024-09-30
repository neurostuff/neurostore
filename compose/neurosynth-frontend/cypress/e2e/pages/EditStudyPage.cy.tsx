/// <reference types="cypress" />

export {};

const PATH = '/projects/abc123/extraction/studies/mock-study-id/edit';
const PAGE_NAME = 'EditStudyPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `https://api.semanticscholar.org/**`, {
            fixture: 'semanticScholar',
        }).as('semanticScholarFixture');

        cy.intercept('GET', `**/api/studies/mock-study-id*`, { fixture: 'study' }).as(
            'studyFixture'
        );
        cy.intercept('GET', `**/api/projects/*`, { fixture: 'projects/project' }).as(
            'projectFixture'
        );
        cy.intercept('GET', `**/api/annotations/*`, { fixture: 'annotation' }).as(
            'annotationFixture'
        );
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');

        cy.intercept('POST', `https://www.google-analytics.com/*/**`, {}).as(
            'googleAnalyticsFixture'
        );

        cy.login('mocked').visit(PATH);
    });

    it('should load', () => {
        cy.visit(PATH)
            .wait('@studyFixture')
            .wait('@projectFixture')
            .wait('@annotationFixture')
            .wait('@semanticScholarFixture')
            .wait('@studysetFixture');
    });

    it('should save and set study with doi and pmid undefined if they are empty', () => {
        cy.intercept('PUT', '**/api/studies/mock-study-id').as('editStudy');

        // ARRANGE
        cy.visit(PATH)
            .wait('@studyFixture')
            .wait('@projectFixture')
            .wait('@annotationFixture')
            .wait('@semanticScholarFixture')
            .wait('@studysetFixture');

        // ACT
        cy.get('div').contains('(name, authors, description, doi, pmid, etc)').click();
        cy.contains('label', 'doi').next().clear();
        cy.contains('label', 'pmid').next().clear();
        cy.contains('label', 'pmcid').next().clear();
        cy.contains('button', 'save').click();

        // ASSERT
        cy.get('@editStudy').its('request.body').should('not.have.a.property', 'doi');
        cy.get('@editStudy').its('request.body').should('not.have.a.property', 'pmid');
        cy.get('@editStudy').its('request.body').should('not.have.a.property', 'pmcid');
    });
});
