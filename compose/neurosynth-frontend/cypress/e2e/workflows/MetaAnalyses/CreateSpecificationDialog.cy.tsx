/// <reference types="cypress" />

describe('CreateSpecificationDialog', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/meta-analyses*`, { fixture: 'metaAnalyses' }).as('metaAnalysesFixture');
        cy.intercept('GET', '**/api/meta-analysis-results/**', {
            fixture: 'metaAnalysisResults',
        }).as('metaAnalysisResultsFixture');
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'projects/projectCanCreateSpecification',
        }).as('projectFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
        cy.intercept('GET', '**/api/annotations/*', { fixture: 'annotation' }).as('annotationFixture');
        cy.intercept('GET', '**/api/meta-analysis-jobs', { fixture: 'MetaAnalysis/jobs/noJobs' }).as('jobsFixture');
    });

    it('should show the dialog', () => {
        cy.login('mocked', { sub: 'github|26612023' }).visit('/projects/abc123').wait('@projectFixture');
        cy.contains('button', 'Meta-Analyses').click();
        cy.contains('button', 'Meta-Analysis Specification').click();
        cy.get('.MuiDialog-container').should('be.visible');
        cy.contains('button', 'Back').should('be.disabled');
    });

    it('should set the default specification values', () => {
        cy.login('mocked', { sub: 'github|26612023' }).visit('/projects/abc123').wait('@projectFixture');
        cy.contains('button', 'Meta-Analyses').click();
        cy.contains('button', 'Meta-Analysis Specification').click();
        cy.get('.MuiDialog-container').should('be.visible');
        cy.contains('MKDADensity').should('exist');
        cy.contains('FDRCorrector').should('exist');
    });

    it('should step through the wizard', () => {
        cy.intercept('POST', '**/api/specifications', {
            id: 'mockedSpecificationId',
        }).as('createSpecificationFixture');
        cy.intercept('POST', '**/api/studysets', {
            id: 'mockedStudySetId',
        });
        cy.intercept('POST', '**/api/annotations', {
            id: 'mockedAnnotationId',
        });
        cy.intercept('POST', '**/api/meta-analyses', {
            id: 'mockedMetaAnalysisId',
            specification: {},
        });
        cy.intercept('GET', '**/api/specifications/*', {
            fixture: 'MetaAnalysis/specification',
        });

        cy.intercept('GET', '**/api/meta-analyses/mockedMetaAnalysisId*', {
            fixture: 'MetaAnalysis/metaAnalysis',
        }).as('MetaAnalysis/metaAnalysesFixture');

        cy.login('mocked', { sub: 'github|26612023' }).visit('/projects/abc123').wait('@projectFixture');
        cy.contains('button', 'Meta-Analyses').click();
        cy.contains('button', 'Meta-Analysis Specification').click();
        cy.contains('Next').click();
        cy.contains('included').should('exist');
        cy.contains('button', 'Next').click();
        cy.contains('button', 'Next').click();
        cy.contains('button', 'Create Meta-Analysis Specification').click();
    });
});
