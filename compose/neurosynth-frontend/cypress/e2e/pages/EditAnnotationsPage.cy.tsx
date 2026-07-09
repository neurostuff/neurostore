/// <reference types="cypress" />

import { AnnotationReturnOneOf } from 'neurostore-typescript-sdk';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';

export {};

const PATH = '/projects/abc123/extraction/annotations';
const PAGE_NAME = 'EditAnnotationsPage';
const MOCKED_USER_SUB = 'auth0|62e0e6c9dd47048572613b4d';
const ANNOTATION_ID = '5LSBDTGqA6RF';

const visitAndWaitForPage = () => cy.visit(PATH).wait('@projectFixture').wait('@annotationFixture');

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', 'https://api.semanticscholar.org/**', {
            fixture: 'semanticScholar',
        }).as('semanticScholarFixture');
        cy.intercept('POST', 'https://www.google-analytics.com/*/**', {}).as('googleAnalyticsFixture');

        cy.fixture('projects/project').then((project: ProjectReturn) => {
            (project as ProjectReturn).id = 'abc123';
            const prov = (project as Record<string, unknown>).provenance as Record<string, unknown> | undefined;
            const curation = prov?.curationMetadata as Record<string, unknown> | undefined;
            const extraction = curation?.extractionMetadata as Record<string, unknown> | undefined;
            if (extraction) extraction.annotationId = ANNOTATION_ID;
            cy.intercept('GET', '**/api/projects/*', project).as('projectFixture');
        });
        cy.fixture('annotation').then((annotation: AnnotationReturnOneOf) => {
            (annotation as Record<string, unknown>).user = MOCKED_USER_SUB;
            (annotation as Record<string, unknown>).id = ANNOTATION_ID;
            cy.intercept('GET', '**/api/annotations/*', annotation).as('annotationFixture');
        });
        cy.intercept('PUT', '**/api/projects/*', { fixture: 'projects/projectPut' }).as('updateProjectFixture');

        cy.login('mocked').visit(PATH);
    });

    it('should load', () => {
        visitAndWaitForPage();
        cy.contains('Annotations').should('be.visible');
        cy.contains('Annotation for studyset').should('be.visible');
    });

    describe('modify columns and save', () => {
        beforeEach(() => {
            visitAndWaitForPage();
        });

        it('adds a column and calls /annotations (not annotation-analyses) with the new key in note_keys and in each note', () => {
            const newNoteKey = 'added_annotation_key';
            cy.intercept('PUT', '**/api/annotations/*', (req) => req.reply(200, {})).as('putAnnotations');
            cy.intercept('POST', '**/api/annotation-analyses/**', (req) => req.reply(200, [])).as(
                'postAnnotationAnalyses'
            );

            cy.get('input[placeholder="New Annotation Key"]').type(newNoteKey);
            cy.contains('button', 'ADD').click();
            cy.contains(newNoteKey).should('exist');
            cy.contains('button', 'save').click();

            cy.get('@putAnnotations')
                .its('request.url')
                .should('include', '/annotations')
                .and('not.include', 'annotation-analyses');
            cy.get('@putAnnotations')
                .its('request.body')
                .then(
                    (body: { note_keys: Record<string, unknown>; notes: Array<{ note: Record<string, unknown> }> }) => {
                        expect(body.note_keys).to.have.property(newNoteKey);
                        expect(body.notes).to.be.an('array').and.not.to.be.empty;
                        body.notes.forEach((note) => {
                            expect(note.note).to.have.property(newNoteKey);
                        });
                    }
                );
        });

        it('removes a column and calls /annotations (not annotation-analyses) with the removed key not in note_keys or notes', () => {
            cy.intercept('PUT', '**/api/annotations/*', (req) => req.reply(200, {})).as('putAnnotations');
            cy.intercept('POST', '**/api/annotation-analyses/**', (req) => req.reply(200, [])).as(
                'postAnnotationAnalyses'
            );

            cy.get('[data-testid="CancelIcon"]').eq(1).click({ force: true });
            cy.contains('button', 'save').click();

            cy.get('@putAnnotations')
                .its('request.url')
                .should('include', '/annotations')
                .and('not.include', 'annotation-analyses');
            cy.get('@putAnnotations')
                .its('request.body')
                .then(
                    (body: { note_keys: Record<string, unknown>; notes: Array<{ note: Record<string, unknown> }> }) => {
                        expect(body.notes).to.be.an('array').and.not.to.be.empty;
                        body.notes.forEach((note) => {
                            expect(note.note).not.to.have.property('string_key');
                        });
                        expect(body.note_keys).not.to.have.property('string_key');
                    }
                );
        });

        it('updates a cell and calls annotation-analyses (not annotations) and includes only the updated notes', () => {
            cy.intercept('PUT', '**/api/annotations/*', (req) => req.reply(200, {})).as('putAnnotations');
            cy.intercept('POST', '**/api/annotation-analyses/**', (req) => req.reply(200, [])).as(
                'postAnnotationAnalyses'
            );

            cy.get('.htCore').find('tbody td').eq(3).click();
            cy.focused().type('_cell_edit').type('{enter}');
            cy.contains('button', 'save').click();

            cy.get('@postAnnotationAnalyses')
                .its('request.url')
                .should('include', 'annotation-analyses')
                .and('not.include', '/annotations/');
            cy.get('@postAnnotationAnalyses')
                .its('request.body')
                .then((body: Array<{ id: string; note: Record<string, unknown> }>) => {
                    expect(body).to.be.an('array').and.have.length(1);
                    const hasUpdatedValue = body.some(
                        (item) =>
                            item.note &&
                            typeof item.note === 'object' &&
                            Object.values(item.note).some((v) => typeof v === 'string' && v.includes('_cell_edit'))
                    );
                    expect(hasUpdatedValue).to.be.true;
                    body.forEach((item) => {
                        expect(item).to.have.property('id');
                        expect(item).to.have.property('note');
                    });
                });
        });
    });

    describe('read-only when user does not own annotation/project', () => {
        beforeEach(() => {
            cy.fixture('projects/project').then((project: ProjectReturn) => {
                project.id = 'abc123';
                project.user = 'other-user-id';
                project.public = true;
                cy.intercept('GET', '**/api/projects/*', project).as('projectFixture');
            });

            visitAndWaitForPage();
        });

        it('shows annotation in read-only mode only', () => {
            cy.wait('@projectFixture').wait('@annotationFixture');
            cy.contains('Annotation for studyset').should('be.visible');
            cy.get('input[placeholder="New Annotation Key"]').should('not.exist');
            cy.contains('button', 'save').should('not.be.visible');
            cy.get('.htCore').should('exist');
        });
    });
});
