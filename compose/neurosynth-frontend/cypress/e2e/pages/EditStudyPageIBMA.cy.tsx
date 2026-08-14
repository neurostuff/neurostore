/// <reference types="cypress" />

import { EAnalysisType, IProvenance } from 'hooks/projects/Project.types';
import { AnnotationReturnOneOf, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';

export {};

const PATH = '/projects/abc123/extraction/studies/b-mock-study-id/edit';
const PAGE_NAME = 'EditStudyIBMAPage';
const SOURCE_STUDY_ID = 'b-mock-study-id';
const LOGGED_IN_USER = 'auth0|62e0e6c9dd47048572613b4d';

const neurostoreApiPattern = (path: string) => `**/api/${path}`;
const neurosynthApiPattern = (path: string) => `**/api/${path}`;

const uncategorizedImagesResponse = {
    metadata: {},
    results: [
        {
            id: 'img-orphan-uncat',
            filename: 'orphan_map.nii',
            analysis: null,
            value_type: 'T',
            public: true,
            created_at: '2023-01-01T00:00:00Z',
            updated_at: null,
            user: null,
            username: null,
            metadata: null,
            space: null,
            add_date: null,
            url: null,
            analysis_name: null,
        },
    ],
};

const visitAndWaitForPage = () => {
    cy.visit(PATH);
    cy.wait('@studyFixture');
    cy.wait('@projectFixture');
    cy.wait('@annotationFixture');
    cy.wait('@studysetFixture');
    cy.wait('@analysesFixture', { timeout: 15000 });
    cy.wait('@uncategorizedImagesFixture', { timeout: 15000 });
};

const waitForAnalysisBoard = () => {
    cy.get('[data-testid="edit-study-analysis-board"]', { timeout: 15000 }).should('exist');
    cy.get('[data-testid="edit-study-analysis-table"]').should('exist');
};

const waitForAnalysisBoardRows = () => {
    waitForAnalysisBoard();
    analysisDataRow('Analysis 1').should('be.visible', { timeout: 15000 });
};

const analysisDataRow = (analysisName: string) =>
    cy
        .get('[data-testid="edit-study-analysis-table"] tbody tr')
        .filter((_, row) => {
            const $row = Cypress.$(row);
            return $row.find('td[colspan]').length === 0 && $row.text().includes(analysisName);
        })
        .first();

const noteCell = (analysisName: string, columnKey: string) =>
    cy
        .get('[data-testid="edit-study-analysis-table"] thead th')
        .contains(columnKey)
        .closest('th')
        .invoke('index')
        .then((columnIndex) => analysisDataRow(analysisName).find('td').eq(columnIndex));

const ensureUncategorizedExpanded = () => {
    cy.get('body').then(($body) => {
        if ($body.find('[data-testid="uncategorized-images-collapsed"]').length) {
            cy.get('[data-testid="uncategorized-images-collapsed"]').click();
        }
    });
    cy.get('[data-testid="uncategorized-images-column"]').should('be.visible');
};

const noteTextarea = (analysisName: string, columnKey: string) =>
    noteCell(analysisName, columnKey).scrollIntoView().find('textarea').first();

const imageListItem = (filename: string) => cy.contains(filename).closest('.MuiListItemButton-root');

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
            (study as Record<string, unknown>).id = SOURCE_STUDY_ID;
            (study as Record<string, unknown>).user = LOGGED_IN_USER;
            cy.intercept('GET', neurostoreApiPattern('studies/*'), study).as('studyFixture');

            cy.fixture('projects/project').then((raw) => {
                const project = raw as ProjectReturn;
                if (project.id) project.id = 'abc123';
                const provenance = (project.provenance || {}) as IProvenance;
                project.provenance = { ...provenance, type: EAnalysisType.IBMA } as ProjectReturn['provenance'];
                cy.intercept('GET', neurosynthApiPattern('projects/*'), project).as('projectFixture');

                cy.fixture('annotation').then((annotation: AnnotationReturnOneOf) => {
                    annotation.note_keys = {
                        ...(annotation.note_keys as Record<string, { type: string; order: number }>),
                        number_key: { type: 'number', order: Object.keys(annotation.note_keys ?? {}).length },
                    };
                    annotation.notes = annotation.notes?.map((note) => {
                        const noteRow = note as NoteCollectionReturn;
                        return {
                            ...noteRow,
                            study: SOURCE_STUDY_ID,
                            note: {
                                ...(noteRow.note as Record<string, unknown>),
                                number_key: 10,
                            },
                        };
                    });
                    cy.intercept('GET', neurostoreApiPattern('annotations/*'), annotation).as('annotationFixture');
                    cy.login('mocked');
                });
            });
        });

        cy.intercept('GET', neurostoreApiPattern('studysets/*'), { fixture: 'studysetNonNested' }).as(
            'studysetFixture'
        );
        cy.intercept('GET', neurostoreApiPattern('analyses/**'), { fixture: 'ibma/analysesByStudy' }).as(
            'analysesFixture'
        );
        cy.intercept('GET', neurostoreApiPattern('images/**'), uncategorizedImagesResponse).as(
            'uncategorizedImagesFixture'
        );
        cy.intercept('POST', neurostoreApiPattern('analyses/**'), (req) =>
            req.reply(201, {
                id: 'analysis-new-cypress',
                name: '',
                description: '',
                study: req.body.study ?? SOURCE_STUDY_ID,
                images: [],
            })
        ).as('postAnalysis');
        cy.intercept('PUT', neurostoreApiPattern('analyses/*'), (req) => req.reply(200, req.body)).as('putAnalysis');
        cy.intercept('PUT', neurostoreApiPattern('images/*'), (req) => req.reply(200, req.body)).as('putImage');
        cy.intercept('DELETE', neurostoreApiPattern('analyses/*'), { statusCode: 204 }).as('deleteAnalysis');
        cy.intercept('PUT', neurostoreApiPattern('annotations/*'), (req) => req.reply(200, req.body)).as(
            'putAnnotation'
        );
        cy.intercept('POST', neurostoreApiPattern('annotation-analyses/**'), (req) => req.reply(200, [])).as(
            'postAnnotationAnalyses'
        );

        cy.intercept('POST', 'https://www.google-analytics.com/*/**', {}).as('googleAnalyticsFixture');

        cy.intercept('PUT', neurosynthApiPattern('projects/*'), { fixture: 'projects/projectPut' }).as(
            'updateProjectFixture'
        );
    });

    it('should load the IBMA study board and analyses UI', () => {
        visitAndWaitForPage();
        waitForAnalysisBoardRows();
        cy.contains('Uncategorized images').should('be.visible');
        cy.contains('Analyses').should('be.visible');
    });

    it('opens Edit Study Details, edits study fields and metadata, and persists on Save', () => {
        cy.intercept('PUT', neurostoreApiPattern(`studies/${SOURCE_STUDY_ID}*`)).as('saveStudy');
        visitAndWaitForPage();

        cy.contains('button', 'Study Details').click();
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
    });

    it('edits an analysis name via dialog PUT', () => {
        visitAndWaitForPage();
        waitForAnalysisBoardRows();
        analysisDataRow('Analysis 1').find('[aria-label="Analysis options"]').click();
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
        waitForAnalysisBoardRows();
        analysisDataRow('Analysis 2').find('[aria-label="Analysis options"]').click();
        cy.contains('[role="menuitem"]', 'Delete analysis').click();
        cy.get('[role="dialog"]').contains('button', 'Delete').click();
        cy.wait('@deleteAnalysis').its('request.method').should('eq', 'DELETE');
    });

    it('adds an annotation column via annotation PUT', () => {
        visitAndWaitForPage();
        waitForAnalysisBoardRows();
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
        waitForAnalysisBoardRows();
        cy.contains('th', 'string_key')
            .find('[aria-label="string_key column options"]')
            .scrollIntoView()
            .click({ force: true });
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
        waitForAnalysisBoardRows();
        noteCell('Analysis 1', 'included').find('input[type="checkbox"]').check({ force: true });
        cy.wait('@postAnnotationAnalyses')
            .its('request.body')
            .then((body: AnnotationAnalysesPayload) => {
                expect(body).to.have.length(1);
                expectNoteCellValue(body[0].note ?? {}, 'included', { value: true, type: 'boolean' });
            });
    });

    it('edits a string cell and POSTs a string value', () => {
        visitAndWaitForPage();
        waitForAnalysisBoardRows();
        noteTextarea('Analysis 1', 'string_key')
            .click({ force: true })
            .clear({ force: true })
            .type('updated string', { force: true })
            .blur({ force: true });
        cy.wait('@postAnnotationAnalyses')
            .its('request.body')
            .then((body: AnnotationAnalysesPayload) => {
                expect(body).to.have.length(1);
                expectNoteCellValue(body[0].note ?? {}, 'string_key', { value: 'updated string', type: 'string' });
            });
    });

    it('clears a string cell and POSTs null', () => {
        visitAndWaitForPage();
        waitForAnalysisBoardRows();
        noteTextarea('Analysis 1', 'string_key').click({ force: true }).clear({ force: true }).blur({ force: true });
        cy.wait('@postAnnotationAnalyses')
            .its('request.body')
            .then((body: AnnotationAnalysesPayload) => {
                expect(body).to.have.length(1);
                expectNoteCellValue(body[0].note ?? {}, 'string_key', { value: null, type: 'null' });
            });
    });

    it('edits a number cell and POSTs a number value', () => {
        visitAndWaitForPage();
        waitForAnalysisBoardRows();
        noteTextarea('Analysis 1', 'number_key')
            .click({ force: true })
            .clear({ force: true })
            .type('42', { force: true })
            .blur({ force: true });
        cy.wait('@postAnnotationAnalyses')
            .its('request.body')
            .then((body: AnnotationAnalysesPayload) => {
                expect(body).to.have.length(1);
                expectNoteCellValue(body[0].note ?? {}, 'number_key', { value: 42, type: 'number' });
            });
    });

    it('clears a number cell and POSTs null', () => {
        visitAndWaitForPage();
        waitForAnalysisBoardRows();
        noteTextarea('Analysis 1', 'number_key').click({ force: true }).clear({ force: true }).blur({ force: true });
        cy.wait('@postAnnotationAnalyses')
            .its('request.body')
            .then((body: AnnotationAnalysesPayload) => {
                expect(body).to.have.length(1);
                expectNoteCellValue(body[0].note ?? {}, 'number_key', { value: null, type: 'null' });
            });
    });

    it('moves an uncategorized image to an analysis via image PUT', () => {
        visitAndWaitForPage();
        waitForAnalysisBoardRows();
        ensureUncategorizedExpanded();
        imageListItem('orphan_map.nii').find('[aria-label="Move image to analysis"]').click();
        cy.contains('[role="menuitem"]', 'Analysis 1').click();
        cy.wait('@putImage')
            .its('request.body')
            .then((body: { analysis?: string }) => {
                expect(body.analysis).to.eq('5KyvcoE3eE8f');
            });
    });

    it('removes an image from an expanded analysis row via image PUT', () => {
        visitAndWaitForPage();
        waitForAnalysisBoardRows();
        analysisDataRow('Analysis 1').find('[aria-label="See images"]').click();
        imageListItem('assigned_map.nii').find('[aria-label="Remove from analysis"]').click();
        cy.wait('@putImage')
            .its('request.body')
            .then((body: { analysis?: string | null }) => {
                expect(body.analysis).to.be.null;
            });
    });

    it('moves an image from one analysis to another via the move menu', () => {
        visitAndWaitForPage();
        waitForAnalysisBoardRows();

        analysisDataRow('Analysis 1').find('[aria-label="See images"]').click();
        imageListItem('assigned_map.nii').find('[aria-label="Move image to analysis"]').click();

        cy.get('[role="menu"]').should('be.visible');
        cy.contains('[role="menuitem"]', 'Analysis 1 (current analysis)').should('be.visible');
        cy.contains('[role="menuitem"]', 'Analysis 2').click();

        cy.wait('@putImage')
            .its('request.body')
            .then((body: { analysis?: string }) => {
                expect(body.analysis).to.eq('B7GDVjuVThso');
            });
    });
});
