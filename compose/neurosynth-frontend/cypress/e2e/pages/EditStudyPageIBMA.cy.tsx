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
});
