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

    describe('ALE validation', () => {
        const openDialogAndSelectALE = () => {
            cy.login('mocked', { sub: 'github|26612023' }).visit('/projects/abc123').wait('@projectFixture');
            cy.contains('button', 'Meta-Analyses').click();
            cy.contains('button', 'Meta-Analysis Specification').click();
            cy.get('.MuiDialog-container').should('be.visible');
            cy.get('.MuiDialog-container input').first().click();
            cy.get('[role="option"]').contains('ALE').click();
            cy.contains('Algorithm arguments').click();
        };

        it('hides kernel__fwhm and kernel__sample_size when "Use Study/Analysis Specific Sample Sizes" is checked', () => {
            openDialogAndSelectALE();
            cy.get('input[name="kernel__fwhm"]').should('exist');
            cy.get('input[name="kernel__sample_size"]').should('exist');
            cy.contains('Use Study/Analysis Specific Sample Sizes').click();
            cy.get('input[name="kernel__fwhm"]').should('not.exist');
            cy.get('input[name="kernel__sample_size"]').should('not.exist');
        });

        it('shows expected links when studies are missing sample size', () => {
            openDialogAndSelectALE();
            cy.contains('Use Study/Analysis Specific Sample Sizes').click();
            cy.contains('The following studies are missing sample sizes').should('be.visible');
            cy.get('a[href*="/extraction/studies/"]').should('have.length.at.least', 1);
        });

        it('disables Next button when studies are missing sample size and checkbox is checked', () => {
            openDialogAndSelectALE();
            cy.contains('Use Study/Analysis Specific Sample Sizes').click();
            cy.contains('button', 'Next').should('be.disabled');
        });

        it('disables kernel__fwhm input when kernel__sample_size has a value', () => {
            openDialogAndSelectALE();
            cy.get('input[name="kernel__fwhm"]').clear();
            cy.get('input[name="kernel__sample_size"]').clear().type('20');
            cy.get('input[name="kernel__fwhm"]').should('be.disabled');
        });

        it('disables kernel__sample_size input when kernel__fwhm has a value', () => {
            openDialogAndSelectALE();
            cy.get('input[name="kernel__sample_size"]').should('be.disabled');
        });

        it('shows OK when all studies have sample size and Next button is enabled', () => {
            cy.intercept('GET', '**/api/annotations/*', {
                fixture: 'MetaAnalysis/annotationAllHaveSampleSize',
            }).as('annotationAllHaveSampleSize');
            openDialogAndSelectALE();
            cy.contains('Use Study/Analysis Specific Sample Sizes').click();
            cy.contains('All studies in the studyset have sample size values.').should('be.visible');
            cy.contains('button', 'Next').should('not.be.disabled');
        });
    });
});
