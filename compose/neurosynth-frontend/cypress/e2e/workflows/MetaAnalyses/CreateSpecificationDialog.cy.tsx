/// <reference types="cypress" />

import { EAnalysisType, IProvenance } from 'hooks/projects/Project.types';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';

const openCreateSpecificationDialog = (projectAlias = 'projectFixture') => {
    cy.login('mocked', { sub: 'github|26612023' }).visit('/projects/abc123').wait(`@${projectAlias}`);
    cy.contains('button', 'Meta-Analyses').click();
    cy.contains('button', 'Meta-Analysis Specification').click();
    cy.get('.MuiDialog-container').should('be.visible');
};

const stubCreateSpecificationApis = () => {
    cy.intercept('POST', '**/api/specifications', {
        id: 'mockedSpecificationId',
    }).as('createSpecificationFixture');
    cy.intercept('POST', '**/api/snapshot-studysets', {
        id: 'mockedStudySetId',
    });
    cy.intercept('POST', '**/api/snapshot-annotations', {
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
};

const completeSpecificationWizard = () => {
    cy.contains('Next').click();
    cy.contains('included').should('exist');
    cy.contains('button', 'Next').click();
    cy.contains('button', 'Next').click();
    cy.contains('button', 'Create Meta-Analysis Specification').click();
};

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
        openCreateSpecificationDialog();
        cy.contains('button', 'Back').should('be.disabled');
    });

    it('should set the default specification values', () => {
        openCreateSpecificationDialog();
        cy.contains('MKDADensity').should('exist');
        cy.contains('FDRCorrector').should('exist');
    });

    it('should step through the wizard', () => {
        stubCreateSpecificationApis();
        openCreateSpecificationDialog();
        completeSpecificationWizard();
    });

    it('submits the selected corrector and its argument values', () => {
        stubCreateSpecificationApis();
        openCreateSpecificationDialog();

        cy.get('.MuiDialog-container')
            .contains('label', 'corrector (optional)')
            .parent()
            .find('input')
            .as('correctorInput');
        cy.get('@correctorInput').click();
        cy.get('[role="option"]').contains('FWECorrector').click();
        cy.get('@correctorInput').should('have.value', 'FWECorrector');
        cy.get('[role="listbox"]').should('not.exist');

        cy.contains('Corrector arguments').closest('.MuiAccordionSummary-root').click();
        cy.contains('Corrector arguments')
            .closest('.MuiAccordion-root')
            .should('have.class', 'Mui-expanded')
            .within(() => {
                cy.get('input[name="n_iters"]').clear({ force: true }).type('1234', { force: true });
                cy.get('input[name="method"]').clear({ force: true }).type('bonferroni', { force: true });
            });

        completeSpecificationWizard();

        cy.wait('@createSpecificationFixture')
            .its('request.body')
            .should((body) => {
                expect(body.corrector).to.deep.include({
                    type: 'FWECorrector',
                });
                expect(body.corrector.args).to.include({
                    method: 'bonferroni',
                    n_iters: 1234,
                });
            });
    });

    it('submits the selected annotation inclusion column', () => {
        stubCreateSpecificationApis();
        openCreateSpecificationDialog();
        cy.contains('Next').click();

        cy.get('.MuiDialog-container')
            .contains('label', 'Inclusion Column')
            .parent()
            .find('input')
            .as('inclusionColumnInput');
        cy.get('@inclusionColumnInput').should('have.value', 'included');
        cy.get('@inclusionColumnInput').click();
        cy.get('[role="option"]').contains('string_key').click();
        cy.get('@inclusionColumnInput').should('have.value', 'string_key');

        cy.get('.MuiDialog-container').contains('label', 'Select value to filter on').parent().find('input').click();
        cy.get('[role="option"]').contains('ABC').click();

        cy.contains('button', 'Next').click();
        cy.contains('button', 'Next').click();
        cy.contains('button', 'Create Meta-Analysis Specification').click();

        cy.wait('@createSpecificationFixture')
            .its('request.body')
            .should((body) => {
                expect(body.filter).to.eq('string_key');
                expect(body.conditions).to.deep.equal(['ABC']);
            });
    });

    describe('IBMA algorithm options', () => {
        beforeEach(() => {
            cy.fixture('projects/projectCanCreateSpecification').then((raw) => {
                const project = raw as ProjectReturn;
                const provenance = (project.provenance || {}) as IProvenance;
                project.provenance = { ...provenance, type: EAnalysisType.IBMA } as ProjectReturn['provenance'];
                cy.intercept('GET', `**/api/projects/*`, project).as('projectIBMAFixture');
            });
        });

        it('defaults to Stouffers and lists only Fishers and Stouffers', () => {
            openCreateSpecificationDialog('projectIBMAFixture');
            cy.get('.MuiDialog-container input').first().should('have.value', 'Stouffers');
            cy.get('.MuiDialog-container').contains('MKDADensity').should('not.exist');

            cy.get('.MuiDialog-container input').first().click();
            cy.get('[role="listbox"] [role="option"]').should('have.length', 2);
            cy.get('[role="option"]').contains('Fishers').should('exist');
            cy.get('[role="option"]').contains('Stouffers').should('exist');
            cy.get('[role="option"]').contains('PermutedOLS').should('not.exist');
            cy.get('[role="option"]').contains('DerSimonianLaird').should('not.exist');
        });

        it('lists only FDRCorrector and omits FWECorrector', () => {
            openCreateSpecificationDialog('projectIBMAFixture');
            cy.get('.MuiDialog-container').contains('label', 'corrector (optional)').parent().find('input').click();
            cy.get('[role="listbox"] [role="option"]').should('have.length', 1);
            cy.get('[role="option"]').contains('FDRCorrector').should('exist');
            cy.get('[role="option"]').contains('FWECorrector').should('not.exist');
        });

        it('can select Fishers', () => {
            openCreateSpecificationDialog('projectIBMAFixture');
            cy.get('.MuiDialog-container input').first().click();
            cy.get('[role="option"]').contains('Fishers').click();
            cy.get('.MuiDialog-container input').first().should('have.value', 'Fishers');
        });

        it('submits Fishers with updated algorithm argument values', () => {
            const setBoolArgument = (parameterName: string, value: boolean) => {
                cy.contains('.MuiTypography-subtitle1', parameterName)
                    .scrollIntoView()
                    .parent()
                    .within(() => {
                        cy.contains('button', String(value)).click();
                    });
            };

            stubCreateSpecificationApis();
            openCreateSpecificationDialog('projectIBMAFixture');
            cy.get('.MuiDialog-container input').first().click();
            cy.get('[role="option"]').contains('Fishers').click();
            cy.get('.MuiDialog-container input').first().should('have.value', 'Fishers');

            cy.contains('Algorithm arguments').click();
            cy.contains('Algorithm arguments')
                .closest('.MuiAccordion-root')
                .within(() => {
                    setBoolArgument('aggressive_mask', true);
                    setBoolArgument('use_sample_size', true);
                    setBoolArgument('two_sided', false);
                });

            completeSpecificationWizard();

            cy.wait('@createSpecificationFixture')
                .its('request.body')
                .should((body) => {
                    expect(body.type).to.eq('IBMA');
                    expect(body.estimator).to.deep.include({
                        type: 'Fishers',
                    });
                    expect(body.estimator.args).to.include({
                        aggressive_mask: true,
                        use_sample_size: true,
                        two_sided: false,
                    });
                });
        });
    });

    describe('ALE validation', () => {
        const openDialogAndSelectALE = () => {
            openCreateSpecificationDialog();
            cy.get('.MuiDialog-container input').first().click();
            cy.get('[role="option"]').contains('ALE').click();
            cy.contains('Algorithm arguments').click();
        };

        const showAleAdvancedSettings = () => {
            cy.contains('button', 'show advanced settings').click();
        };

        it('shows the sample size option and hides algorithm inputs until advanced settings are shown', () => {
            openDialogAndSelectALE();
            cy.contains('Use Study/Analysis Specific Sample Sizes').should('be.visible');
            cy.contains('button', 'show advanced settings').should('be.visible');
            cy.get('input[name="kernel__fwhm"]').should('not.be.visible');
            showAleAdvancedSettings();
            cy.get('input[name="kernel__fwhm"]').scrollIntoView().should('be.visible');
        });

        it('replaces kernel inputs with an alert when using study sample sizes', () => {
            openDialogAndSelectALE();
            showAleAdvancedSettings();
            cy.contains('Use Study/Analysis Specific Sample Sizes').click();
            cy.get('input[name="kernel__fwhm"]').should('not.exist');
            cy.get('input[name="kernel__sample_size"]').should('not.exist');
            cy.contains('This input can only be used when Use Study/Analysis Specific Sample Sizes is not selected')
                .scrollIntoView()
                .should('be.visible');
        });

        it('disables Next and lists studies missing sample size when that option is checked', () => {
            openDialogAndSelectALE();
            cy.contains('Use Study/Analysis Specific Sample Sizes').click();
            cy.contains('The following studies are missing sample sizes').should('be.visible');
            cy.get('a[href*="/extraction/studies/"]').should('have.length.at.least', 1);
            cy.contains('button', 'Next').should('be.disabled');
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
