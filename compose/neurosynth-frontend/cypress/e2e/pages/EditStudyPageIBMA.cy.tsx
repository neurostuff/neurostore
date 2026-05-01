/// <reference types="cypress" />

import { EAnalysisType, IProvenance } from 'hooks/projects/Project.types';
import { AnnotationReturnOneOf, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';

export {};

const PATH = '/projects/abc123/extraction/studies/b-mock-study-id/edit';
const PAGE_NAME = 'EditStudyIBMAPage';

const visitAndWaitForPage = () =>
    cy.visit(PATH).wait('@studyFixture').wait('@projectFixture').wait('@annotationFixture').wait('@studysetFixture');

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', 'https://api.semanticscholar.org/**', {
            fixture: 'semanticScholar',
        }).as('semanticScholarFixture');

        cy.fixture('study').then((study) => {
            (study as Record<string, unknown>).id = 'b-mock-study-id';
            cy.intercept('GET', '**/api/studies/*', study).as('studyFixture');
        });
        cy.fixture('projects/project').then((raw) => {
            const project = raw as ProjectReturn;
            if (project.id) project.id = 'abc123';
            const provenance = (project.provenance || {}) as IProvenance;
            project.provenance = { ...provenance, type: EAnalysisType.IBMA } as ProjectReturn['provenance'];
            cy.intercept('GET', '**/api/projects/*', project).as('projectFixture');
        });
        cy.fixture('annotation').then((annotation: AnnotationReturnOneOf) => {
            annotation.notes = annotation.notes?.map((note) => ({
                ...(note as NoteCollectionReturn),
                study: 'b-mock-study-id',
            }));
            cy.intercept('GET', '**/api/annotations/*', annotation).as('annotationFixture');
        });
        cy.intercept('GET', '**/api/studysets/*', { fixture: 'studysetNonNested' }).as('studysetFixture');

        cy.intercept('POST', 'https://www.google-analytics.com/*/**', {}).as('googleAnalyticsFixture');

        cy.intercept('PUT', '**/api/projects/*', { fixture: 'projects/projectPut' }).as('updateProjectFixture');

        cy.login('mocked').visit(PATH);
    });

    it('should load the IBMA study board and analyses UI', () => {
        visitAndWaitForPage();
        cy.get('[data-testid="edit-study-analysis-board"]').should('exist');
        cy.get('[data-testid="edit-study-analysis-table"]').should('exist');
        cy.contains('Uncategorized maps').should('be.visible');
        cy.contains('Analyses').should('be.visible');
    });

    it('opens Edit Study Details, edits study fields and metadata, and persists on Save', () => {
        cy.intercept('PUT', '**/api/studies/b-mock-study-id').as('saveStudy');
        visitAndWaitForPage();

        cy.contains('button', 'Edit Study Details').click();
        cy.get('[role="dialog"]').should('be.visible');
        cy.get('[data-testid="edit-study-ibma-details-dialog"]').should('be.visible');

        cy.get('[role="dialog"]').within(() => {
            cy.contains('label', 'Title').parent().find('input').clear().type('IBMA dialog title');
            cy.get('input[placeholder="New metadata key"]').type('cypress_meta_key');
            cy.get('input[placeholder="New metadata value"]').type('cypress_meta_value');
            cy.contains('button', 'ADD').click();
            cy.contains('button', 'Close').click();
        });

        cy.get('[data-testid="SaveIcon"]').click();

        cy.wait('@saveStudy')
            .its('request.body')
            .then((body: { name: string; metadata: Record<string, string> }) => {
                expect(body.name).to.eq('IBMA dialog title');
                expect(body.metadata).to.have.property('cypress_meta_key', 'cypress_meta_value');
            });
    });
});
