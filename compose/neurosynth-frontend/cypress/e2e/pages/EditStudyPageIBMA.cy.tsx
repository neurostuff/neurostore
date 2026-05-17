/// <reference types="cypress" />

import { EAnalysisType, IProvenance } from 'hooks/projects/Project.types';
import { AnnotationReturnOneOf, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';

export {};

const PATH = '/projects/abc123/extraction/studies/b-mock-study-id/edit';
const PAGE_NAME = 'EditStudyIBMAPage';

const visitAndWaitForPage = () =>
    cy.visit(PATH).wait('@studyFixture').wait('@projectFixture').wait('@annotationFixture').wait('@studysetFixture');

const waitForAnalysisBoard = () => {
    cy.get('[data-testid="edit-study-analysis-board"]', { timeout: 15000 }).should('exist');
    cy.get('[data-testid="edit-study-analysis-table"]').should('exist');
};

const analysisOneRow = () => cy.contains('[data-testid="edit-study-analysis-table"] tbody tr', 'Analysis 1').first();

type AnnotationAnalysesPayload = Array<{ id?: string; note?: Record<string, unknown> }>;

const expectNoteCellValue = (
    note: Record<string, unknown>,
    key: string,
    expected: { value: unknown; type: 'string' | 'number' | 'boolean' | 'null' }
) => {
    expect(note).to.have.property(key);
    if (expected.type === 'null') {
        expect(note[key]).to.be.null;
        return;
    }
    expect(note[key]).to.eq(expected.value);
    expect(note[key]).to.satisfy((v: unknown) => v === null || typeof v === expected.type);
};

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
            annotation.note_keys = {
                ...(annotation.note_keys as Record<string, { type: string; order: number }>),
                number_key: { type: 'number', order: Object.keys(annotation.note_keys ?? {}).length },
            };
            annotation.notes = annotation.notes?.map((note) => {
                const noteRow = note as NoteCollectionReturn;
                return {
                    ...noteRow,
                    study: 'b-mock-study-id',
                    note: {
                        ...(noteRow.note as Record<string, unknown>),
                        number_key: 10,
                    },
                };
            });
            cy.intercept('GET', '**/api/annotations/*', annotation).as('annotationFixture');
        });
        cy.intercept('GET', '**/api/studysets/*', { fixture: 'studysetNonNested' }).as('studysetFixture');
        cy.intercept('GET', '**/api/analyses*', { fixture: 'ibma/analysesByStudy' }).as('analysesFixture');
        cy.intercept('POST', '**/api/analyses/**', (req) =>
            req.reply(201, {
                id: 'analysis-new-cypress',
                name: '',
                description: '',
                study: 'b-mock-study-id',
                images: [],
            })
        ).as('postAnalysis');
        cy.intercept('PUT', '**/api/analyses/*', (req) => req.reply(200, req.body)).as('putAnalysis');
        cy.intercept('PUT', '**/api/images/*', (req) => req.reply(200, req.body)).as('putImage');
        cy.intercept('DELETE', '**/api/analyses/*', { statusCode: 204 }).as('deleteAnalysis');
        cy.intercept('PUT', '**/api/annotations/*', (req) => req.reply(200, req.body)).as('putAnnotation');
        cy.intercept('POST', '**/api/annotation-analyses/**', (req) => req.reply(200, [])).as('postAnnotationAnalyses');

        cy.intercept('POST', 'https://www.google-analytics.com/*/**', {}).as('googleAnalyticsFixture');

        cy.intercept('PUT', '**/api/projects/*', { fixture: 'projects/projectPut' }).as('updateProjectFixture');

        cy.login('mocked').visit(PATH);
    });

    it('should load the IBMA study board and analyses UI', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();
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
            cy.contains('button', 'Save').click();
        });

        cy.wait('@saveStudy')
            .its('request.body')
            .then((body: { name: string; metadata: Record<string, string> }) => {
                expect(body.name).to.eq('IBMA dialog title');
                expect(body.metadata).to.have.property('cypress_meta_key', 'cypress_meta_value');
            });
    });

    it('creates an analysis via POST', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();
        cy.contains('button', 'Analysis').click();
        cy.wait('@postAnalysis').its('request.method').should('eq', 'POST');
        cy.wait('@putAnnotation');
    });

    it('edits an analysis name via dialog PUT', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();
        cy.contains('Analysis 1').parent().find('[aria-label="Analysis options"]').click();
        cy.contains('[role="menuitem"]', 'Edit analysis').click();
        cy.get('[role="dialog"]').within(() => {
            cy.contains('label', 'Name').parent().find('input').clear().type('Renamed analysis');
            cy.contains('button', 'Save').click();
        });
        cy.wait('@putAnalysis')
            .its('request.body')
            .then((body: { name: string }) => {
                expect(body.name).to.eq('Renamed analysis');
            });
    });

    it('deletes an analysis via DELETE', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();
        cy.contains('Analysis 2').parent().find('[aria-label="Analysis options"]').click();
        cy.contains('[role="menuitem"]', 'Delete analysis').click();
        cy.get('[role="dialog"]').contains('button', 'Delete').click();
        cy.wait('@deleteAnalysis').its('request.method').should('eq', 'DELETE');
    });

    it('adds an annotation column via annotation PUT', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();
        cy.get('[data-testid="new-annotation-column-open-button"]').click();
        cy.get('[role="dialog"]').within(() => {
            cy.contains('label', /column key/i)
                .parent()
                .find('input')
                .type('cypress_col');
            cy.contains('button', 'Save').click();
        });
        cy.wait('@putAnnotation')
            .its('request.body')
            .then((body: { note_keys?: Record<string, unknown> }) => {
                expect(body.note_keys).to.have.property('cypress_col');
            });
    });

    it('removes an annotation column via header menu and annotation PUT', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();
        cy.contains('th', 'string_key').find('[aria-label="string_key column options"]').click();
        cy.contains('[role="menuitem"]', 'Remove column').click();
        cy.get('[role="dialog"]').contains('button', 'Remove').click();
        cy.wait('@putAnnotation')
            .its('request.body')
            .then((body: { note_keys?: Record<string, unknown> }) => {
                expect(body.note_keys).not.to.have.property('string_key');
            });
    });

    it('edits a boolean cell via annotation-analyses POST', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();
        cy.get('[data-testid="edit-study-analysis-table"]').find('input[type="checkbox"]').first().click();
        cy.wait('@postAnnotationAnalyses')
            .its('request.body')
            .then((body: AnnotationAnalysesPayload) => {
                expect(body).to.have.length(1);
                expectNoteCellValue(body[0].note ?? {}, 'included', { value: true, type: 'boolean' });
            });
    });

    it('edits a string cell and POSTs a string value', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();
        analysisOneRow().find('textarea').click().clear().type('updated string').blur();
        cy.wait('@postAnnotationAnalyses')
            .its('request.body')
            .then((body: AnnotationAnalysesPayload) => {
                expect(body).to.have.length(1);
                expectNoteCellValue(body[0].note ?? {}, 'string_key', { value: 'updated string', type: 'string' });
            });
    });

    it('clears a string cell and POSTs null', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();
        analysisOneRow().find('textarea').click().clear().blur();
        cy.wait('@postAnnotationAnalyses')
            .its('request.body')
            .then((body: AnnotationAnalysesPayload) => {
                expect(body).to.have.length(1);
                expectNoteCellValue(body[0].note ?? {}, 'string_key', { value: null, type: 'null' });
            });
    });

    it('edits a number cell and POSTs a number value', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();
        analysisOneRow().find('input[type="number"]').click().clear().type('42').blur();
        cy.wait('@postAnnotationAnalyses')
            .its('request.body')
            .then((body: AnnotationAnalysesPayload) => {
                expect(body).to.have.length(1);
                expectNoteCellValue(body[0].note ?? {}, 'number_key', { value: 42, type: 'number' });
            });
    });

    it('clears a number cell and POSTs null', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();
        analysisOneRow().find('input[type="number"]').click().clear().blur();
        cy.wait('@postAnnotationAnalyses')
            .its('request.body')
            .then((body: AnnotationAnalysesPayload) => {
                expect(body).to.have.length(1);
                expectNoteCellValue(body[0].note ?? {}, 'number_key', { value: null, type: 'null' });
            });
    });

    it('moves an uncategorized map to an analysis via image PUT', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();
        cy.contains('orphan_map.nii').parent().find('[aria-label="Categorize map"]').click();
        cy.contains('[role="menuitem"]', 'Analysis 1').click();
        cy.wait('@putImage')
            .its('request.body')
            .then((body: { analysis?: string }) => {
                expect(body.analysis).to.eq('5KyvcoE3eE8f');
            });
    });

    it('removes a map from an expanded analysis row via image PUT', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();
        cy.contains('Analysis 1').parent().find('[aria-label="See brain maps"]').click();
        cy.contains('assigned_map.nii').parent().find('[aria-label="Remove map from analysis"]').click();
        cy.wait('@putImage')
            .its('request.body')
            .then((body: { analysis?: string | null }) => {
                expect(body.analysis).to.be.null;
            });
    });

    it('moves a map from one analysis to another via image PUT', () => {
        visitAndWaitForPage();
        waitForAnalysisBoard();

        cy.contains('Analysis 1').parent().find('[aria-label="See brain maps"]').click();
        cy.contains('assigned_map.nii').parent().find('[aria-label="Remove map from analysis"]').click();
        cy.wait('@putImage')
            .its('request.body')
            .then((body: { analysis?: string | null }) => {
                expect(body.analysis).to.be.null;
            });

        cy.contains('assigned_map.nii').parent().find('[aria-label="Categorize map"]').click();
        cy.contains('[role="menuitem"]', 'Analysis 2').click();
        cy.wait('@putImage')
            .its('request.body')
            .then((body: { analysis?: string }) => {
                expect(body.analysis).to.eq('B7GDVjuVThso');
            });
    });
});
