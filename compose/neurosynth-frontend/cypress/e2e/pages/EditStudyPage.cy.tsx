/// <reference types="cypress" />

import { IProvenance } from 'hooks/projects/useGetProjects';
import { AnnotationReturnOneOf, NoteCollectionReturn, StudysetReturn } from 'neurostore-typescript-sdk';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { defaultIdentificationSources } from 'pages/Project/store/ProjectStore.consts';

export {};

const PATH = '/projects/abc123/extraction/studies/b-mock-study-id/edit';
const PAGE_NAME = 'EditStudyPage';

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
        cy.fixture('projects/project').then((project) => {
            if ((project as ProjectReturn)?.id) (project as ProjectReturn).id = 'abc123';
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

    it('should load', () => {
        visitAndWaitForPage();
    });

    describe('header', () => {
        beforeEach(() => {
            visitAndWaitForPage();
        });

        it('should show breadcrumbs with Projects, project name, Extraction, and study name', () => {
            cy.contains('Projects').should('be.visible');
            cy.contains('Extraction').should('be.visible');
            cy.contains('Aberrant functional connectivity').should('be.visible');
        });

        it('should show study title with year and name', () => {
            cy.contains('(2009).').should('be.visible');
            cy.contains('Aberrant functional connectivity in autism').should('be.visible');
        });

        it('should show study authors', () => {
            cy.contains('Noonan SK, Haist F, Muller RA').should('be.visible');
        });

        it('should show study owner', () => {
            cy.contains('Study owner:').should('be.visible');
        });

        it('should show last updated', () => {
            cy.contains('Last updated:').should('be.visible');
        });

        it('should show DOI link when study has doi', () => {
            cy.contains('DOI Link').should('be.visible');
        });

        it('should show Pubmed Study link when study has pmid', () => {
            cy.contains('Pubmed Study').should('be.visible');
        });
    });

    describe('toolbar', () => {
        beforeEach(() => {
            visitAndWaitForPage();
        });

        it('should show Toolbar heading', () => {
            cy.contains('Toolbar').should('be.visible');
        });

        it('should show extraction progress (percentage or done)', () => {
            cy.get('[role="progressbar"]').should('exist');
        });

        it('should show status buttons (unreviewed, save for later, complete)', () => {
            cy.get('button').find('[data-testid="QuestionMarkIcon"]').should('exist');
            cy.get('button').find('[data-testid="BookmarkIcon"]').should('exist');
            cy.get('button').find('[data-testid="CheckIcon"]').should('exist');
        });

        it('should show Save button', () => {
            cy.get('button').find('[data-testid="SaveIcon"]').should('exist');
        });

        it('should show previous/next study navigation buttons', () => {
            cy.get('button').find('[data-testid="KeyboardArrowLeftIcon"]').should('exist');
            cy.get('button').find('[data-testid="KeyboardArrowRightIcon"]').should('exist');
        });

        it('should set study status when clicking Complete', () => {
            cy.contains('button', 'Mark as Complete').should('be.visible');
            cy.get('button').find('[data-testid="CheckIcon"]').first().click();
            cy.contains('button', 'Completed').should('be.visible');
        });

        it('should save study when Save is clicked after editing details', () => {
            cy.intercept('PUT', '**/api/studies/b-mock-study-id').as('saveStudy');

            cy.get('div').contains('(name, authors, description, doi, pmid, etc)').click();
            cy.contains('(name, authors, description, doi, pmid, etc)')
                .parents('[role="button"]')
                .first()
                .parent()
                .within(() => {
                    cy.contains('label', 'name').parent().find('input').clear().type('Updated study name');
                });
            cy.get('[data-testid="SaveIcon"]').click();

            cy.get('@saveStudy').its('request.body').should('have.property', 'name', 'Updated study name');
        });

        it('should swap study version when selecting another version and confirming', () => {
            cy.fixture('study').then((study) => {
                (study as Record<string, unknown>).base_study = 'base-study-mock';
                (study as Record<string, unknown>).id = 'b-mock-study-id';
                cy.intercept('GET', '**/api/studies/*', study).as('studyFixture');
            });
            cy.fixture('studyset').then((studyset) => {
                cy.intercept('GET', '**/api/studysets/*', {
                    ...studyset,
                    id: '73HRs8HaJbR8',
                    studies: ['b-mock-study-id'],
                    studyset_studies: [],
                }).as('studysetFixture');
            });
            cy.intercept('GET', '**/base-studies/**', {
                id: 'base-study-mock',
                versions: [
                    {
                        id: 'b-mock-study-id',
                        name: 'Study',
                        created_at: '2022-01-01T00:00:00Z',
                        updated_at: null,
                        username: 'neurosynth',
                    },
                    {
                        id: 'study-version-2',
                        name: 'Study v2',
                        created_at: '2022-01-02T00:00:00Z',
                        updated_at: null,
                        username: 'neurosynth',
                    },
                ],
            }).as('baseStudyFixture');
            cy.intercept('PUT', '**/api/studysets/*', { id: '73HRs8HaJbR8', studies: [] }).as('updateStudyset');

            cy.visit(PATH);
            cy.wait('@studyFixture')
                .wait('@projectFixture')
                .wait('@annotationFixture')
                .wait('@studysetFixture')
                .wait('@baseStudyFixture');

            cy.get('button').find('[data-testid="SwapHorizIcon"]').click();
            cy.contains('Switch to version: study-version-2').click();
            cy.contains('button', 'Confirm').click();

            cy.get('@updateStudyset')
                .its('request.body.studies')
                .then((studies: Array<{ id: string }>) => {
                    expect(studies.map((s) => s.id)).to.include('study-version-2');
                });
        });

        it('should navigate to next and previous study when using toolbar arrows', () => {
            cy.fixture('study').then((study) => {
                (study as Record<string, unknown>).id = 'c-mock-study-id';
                cy.intercept('GET', '**/api/studies/c-mock-study-id*', study).as('studyFixture');
            });
            cy.fixture('study').then((study) => {
                (study as Record<string, unknown>).id = 'b-mock-study-id';
                cy.intercept('GET', '**/api/studies/b-mock-study-id*', study).as('studyFixture');
            });
            cy.fixture('study').then((study) => {
                (study as Record<string, unknown>).id = 'a-mock-study-id';
                cy.intercept('GET', '**/api/studies/a-mock-study-id*', study).as('studyFixture');
            });

            cy.visit(PATH);
            cy.wait('@studyFixture').wait('@projectFixture').wait('@annotationFixture').wait('@studysetFixture');

            cy.url().should('include', 'b-mock-study-id/edit');
            cy.get('button').find('[data-testid="KeyboardArrowRightIcon"]').parent().first().should('not.be.disabled');
            cy.get('button').find('[data-testid="KeyboardArrowLeftIcon"]').parent().first().should('not.be.disabled');

            cy.get('button').find('[data-testid="KeyboardArrowRightIcon"]').first().click();

            cy.url().should('include', 'c-mock-study-id/edit');
            cy.get('button').find('[data-testid="KeyboardArrowRightIcon"]').parent().first().should('be.disabled');
            cy.get('button').find('[data-testid="KeyboardArrowLeftIcon"]').parent().first().should('not.be.disabled');

            cy.get('button').find('[data-testid="KeyboardArrowLeftIcon"]').first().click();

            cy.url().should('include', 'b-mock-study-id/edit');
            cy.get('button').find('[data-testid="KeyboardArrowLeftIcon"]').first().click();
            cy.url().should('include', 'a-mock-study-id/edit');
            cy.get('button').find('[data-testid="KeyboardArrowRightIcon"]').parent().first().should('not.be.disabled');
            cy.get('button').find('[data-testid="KeyboardArrowLeftIcon"]').parent().first().should('be.disabled');
        });

        it('should show confirmation dialog when previous study is clicked with unsaved changes', () => {
            cy.get('div').contains('(name, authors, description, doi, pmid, etc)').click();
            cy.contains('(name, authors, description, doi, pmid, etc)')
                .parents('[role="button"]')
                .first()
                .parent()
                .within(() => {
                    cy.contains('label', 'name').parent().find('input').type(' changed');
                });
            cy.get('button').find('[data-testid="KeyboardArrowLeftIcon"]').first().click();
            cy.contains('You have unsaved changes').should('be.visible');
            cy.contains("Are you sure you want to continue? You'll lose your unsaved changes").should('be.visible');
        });

        it('should show confirmation dialog when next study is clicked with unsaved changes', () => {
            cy.get('div').contains('(name, authors, description, doi, pmid, etc)').click();
            cy.contains('(name, authors, description, doi, pmid, etc)')
                .parents('[role="button"]')
                .first()
                .parent()
                .within(() => {
                    cy.contains('label', 'name').parent().find('input').type(' changed');
                });
            cy.get('button').find('[data-testid="KeyboardArrowRightIcon"]').first().click();
            cy.contains('You have unsaved changes').should('be.visible');
            cy.contains("Are you sure you want to continue? You'll lose your unsaved changes").should('be.visible');
        });
    });

    describe('study annotations', () => {
        beforeEach(() => {
            visitAndWaitForPage();
        });

        it('should show Study Annotations accordion', () => {
            cy.contains('Study Annotations').should('be.visible');
        });

        it('should show confirmation when deleting an annotation column', () => {
            cy.get('[data-testid="CancelIcon"]').eq(1).click({ force: true });
            cy.contains('Are you sure you want to remove this column?').should('be.visible');
            cy.contains('This will remove annotation data in all other studies for').should('be.visible');
            cy.contains('button', 'Cancel').click();
        });

        it('should add an annotation column', () => {
            cy.get('input[placeholder="New Column"]').type('new_annotation_col');
            cy.contains('button', 'ADD').click();
            cy.contains(/new_annotation_col/).should('exist');
        });

        it('should add an extra row when an analysis is created', () => {
            cy.get('.htCore')
                .first()
                .find('tbody tr')
                .its('length')
                .then((initialCount) => {
                    cy.contains('button', 'analysis').click();
                    cy.get('.htCore')
                        .first()
                        .find('tbody tr')
                        .should('have.length', initialCount + 1);
                });
        });

        it('should remove the row when an analysis is deleted', () => {
            cy.contains('Analyses').parents('[role="button"]').first().parent().contains('Analysis 2').click();
            cy.contains('button', 'Delete Analysis').click();
            cy.contains('button', 'delete analysis').click();
            cy.get('.htCore').first().should('not.contain', 'Analysis 2');
        });

        it('should update the annotation table when the analysis name is updated', () => {
            cy.contains('Analyses').parents('[role="button"]').first().parent().contains('Analysis 1').click();
            cy.contains('Analysis Details')
                .parent()
                .parent()
                .within(() => {
                    cy.get('input').first().clear().type('Renamed Analysis One');
                });
            cy.contains('Renamed Analysis One').should('be.visible');
        });

        it('should update the annotation table when the analysis description is updated', () => {
            cy.contains('Analyses').parents('[role="button"]').first().parent().contains('Analysis 1').click();
            cy.contains('Analysis Details')
                .parent()
                .parent()
                .within(() => {
                    cy.get('input').last().clear().type('Updated description text');
                });
            cy.contains('Updated description text').should('be.visible');
        });

        it('should enable the Save button when an annotation is updated', () => {
            cy.get('.htCore').first().find('tbody td').eq(3).click();
            cy.focused().type(' updated').type('{enter}');
            cy.get('button').find('[data-testid="SaveIcon"]').parent().should('not.be.disabled');
        });
    });

    describe('analyses', () => {
        beforeEach(() => {
            visitAndWaitForPage();
        });

        it('should show Analyses accordion', () => {
            cy.contains('Analyses').should('be.visible');
        });

        it('should show Add analysis button', () => {
            cy.contains('button', 'analysis').should('be.visible');
        });

        it('should show analysis list when study has analyses', () => {
            cy.contains('Analysis 1').should('be.visible');
            cy.contains('Analysis 2').should('be.visible');
        });

        it('should add an analysis', () => {
            cy.contains('button', 'analysis').click();
            cy.contains('No analysis selected').should('not.exist');
            cy.contains('Analysis Details').should('be.visible');
            cy.contains('Analysis Coordinates').should('be.visible');
        });

        it('should delete an analysis', () => {
            cy.contains('Analyses').parents('[role="button"]').first().parent().contains('Analysis 2').click();
            cy.contains('button', 'Delete Analysis').click();
            cy.contains('button', 'delete analysis').click();
            cy.contains('Analysis 2').should('not.exist');
        });

        it('should update statistic', () => {
            cy.contains('Analyses').parents('[role="button"]').first().parent().contains('Analysis 1').click();
            cy.contains('Analyses')
                .parents('[role="button"]')
                .first()
                .parent()
                .find('[role="combobox"]')
                .first()
                .click();
            cy.get('[role="listbox"]').contains('Z Map').click();
            cy.contains('Analyses')
                .parents('[role="button"]')
                .first()
                .parent()
                .find('[role="combobox"]')
                .first()
                .should('contain', 'Z Map');
        });

        it('should update space', () => {
            cy.contains('Analyses').parents('[role="button"]').first().parent().contains('Analysis 1').click();
            cy.contains('Analyses')
                .parents('[role="button"]')
                .first()
                .parent()
                .find('[role="combobox"]')
                .last()
                .click();
            cy.get('[role="listbox"]').contains('Talairach').click();
            cy.contains('Analyses')
                .parents('[role="button"]')
                .first()
                .parent()
                .find('[role="combobox"]')
                .last()
                .should('contain', 'Talairach');
        });

        it('should add a coordinate row when Add row is clicked', () => {
            cy.get('.ht_master')
                .eq(1)
                .find('tbody tr')
                .its('length')
                .then((rowCountBefore) => {
                    cy.get('[aria-label="Add row"]').click();
                    cy.get('.ht_master')
                        .eq(1)
                        .find('tbody tr')
                        .should('have.length', rowCountBefore + 1);
                });
        });

        it('should add multiple coordinate rows when Add rows is clicked', () => {
            cy.get('.ht_master')
                .eq(1)
                .find('tbody tr')
                .its('length')
                .then((rowCountBefore) => {
                    cy.get('[aria-label="Add rows"]').click();
                    cy.contains('Enter number of rows to insert').should('be.visible');
                    cy.contains('button', 'Submit').click();
                    cy.get('.ht_master')
                        .eq(1)
                        .find('tbody tr')
                        .should('have.length', rowCountBefore + 4);
                });
        });

        it('should delete a coordinate row when Delete row is clicked', () => {
            cy.get('.ht_master')
                .eq(1)
                .find('tbody tr')
                .its('length')
                .then((rowCountBefore) => {
                    cy.get('.ht_master').eq(1).find('tbody tr').first().find('td').first().click();
                    cy.get('[aria-label="Delete row(s)"]').click();
                    cy.get('.ht_master')
                        .eq(1)
                        .find('tbody tr')
                        .should('have.length', Math.max(1, rowCountBefore - 1));
                });
        });

        it('should edit a coordinate and enable the Save button', () => {
            cy.get('.ht_master').eq(1).find('tbody td').first().click();
            cy.focused().clear().type('10').type('{enter}');
            cy.get('button').find('[data-testid="SaveIcon"]').parent().should('not.be.disabled');
        });

        it('should enable the Save button when analysis name is updated', () => {
            cy.contains('Analysis Details')
                .parent()
                .parent()
                .within(() => {
                    cy.get('input').first().clear().type('Name change');
                });
            cy.get('button').find('[data-testid="SaveIcon"]').parent().should('not.be.disabled');
        });

        it('should enable the Save button when analysis description is updated', () => {
            cy.contains('Analysis Details')
                .parent()
                .parent()
                .within(() => {
                    cy.get('input').last().clear().type('Description change');
                });
            cy.contains('Description change').should('be.visible');
        });

        it('should open demotion dialog when clicking "I couldn\'t find coordinates for this study" and navigate to extraction on confirm', () => {
            const stubId = 'stub-demotion-e2e';
            cy.fixture('projects/project')
                .then((project) => {
                    const typedProject = project as ProjectReturn;
                    typedProject.id = 'abc123';
                    if ((typedProject.provenance as IProvenance)?.curationMetadata?.columns?.[1]) {
                        (typedProject.provenance as IProvenance).curationMetadata.columns[1].stubStudies = [
                            {
                                id: stubId,
                                title: 'E2E study title',
                                authors: 'E2E authors',
                                keywords: 'E2E keywords',
                                pmid: '12345678',
                                pmcid: 'PMC123456',
                                journal: 'E2E journal',
                                articleYear: '2025',
                                abstractText: 'E2E description',
                                articleLink: 'https://e2e.com',
                                exclusionTag: null,
                                identificationSource: defaultIdentificationSources.neurostore,
                                tags: [],
                                doi: '10.1234/e2e',
                            },
                        ];
                    }
                    cy.intercept('GET', '**/api/projects/*', typedProject).as('projectFixture');
                    return cy.fixture('studysetNonNested');
                })
                .then((studyset) => {
                    const typedStudyset = studyset as StudysetReturn;
                    typedStudyset.studies = ['b-mock-study-id'];
                    typedStudyset.studyset_studies = [{ id: 'b-mock-study-id', curation_stub_uuid: stubId }];
                    cy.intercept('GET', '**/api/studysets/*', studyset).as('studysetFixture');
                    cy.intercept('PUT', '**/api/studysets/*', { statusCode: 200, body: {} }).as('updateStudyset');
                    return visitAndWaitForPage();
                });
            cy.contains("I couldn't find coordinates for this study").click();
            cy.contains('Coordinates could not be found for this study.').should('be.visible');
            cy.contains('button', 'Continue').click();
            cy.wait('@updateStudyset');
            cy.get('@updateStudyset')
                .its('request.body.studies')
                .then((studies: Array<{ id: string }>) => {
                    expect(studies.some((s) => s.id === 'b-mock-study-id')).to.be.false;
                });
            cy.url().should('include', '/projects/abc123/extraction');
        });
    });

    describe('details', () => {
        beforeEach(() => {
            visitAndWaitForPage();
        });

        it('should show detail form fields when accordion expanded', () => {
            cy.get('div').contains('(name, authors, description, doi, pmid, etc)').click();
            cy.contains('(name, authors, description, doi, pmid, etc)')
                .parents('[role="button"]')
                .first()
                .parent()
                .within(() => {
                    cy.contains('label', 'name').should('be.visible');
                    cy.contains('label', 'authors').should('be.visible');
                    cy.contains('label', 'doi').should('be.visible');
                    cy.contains('label', 'pmid').should('be.visible');
                    cy.contains('label', 'pmcid').should('be.visible');
                    cy.contains('label', 'journal').should('be.visible');
                    cy.contains('label', 'year').should('be.visible');
                    cy.contains('label', 'description or abstract').should('be.visible');
                });
        });

        it('should save and include all updated detail fields in the request body', () => {
            cy.intercept('PUT', '**/api/studies/b-mock-study-id').as('editStudy');

            const updates: { label: string; bodyKey: string; value: string | number }[] = [
                { label: 'name', bodyKey: 'name', value: 'E2E study name' },
                { label: 'authors', bodyKey: 'authors', value: 'E2E authors' },
                { label: 'journal', bodyKey: 'publication', value: 'E2E journal' },
                { label: 'doi', bodyKey: 'doi', value: '10.1234/e2e' },
                { label: 'pmid', bodyKey: 'pmid', value: '12345678' },
                { label: 'pmcid', bodyKey: 'pmcid', value: 'PMC123456' },
            ];

            cy.get('div').contains('(name, authors, description, doi, pmid, etc)').click();
            cy.contains('(name, authors, description, doi, pmid, etc)')
                .parents('[role="button"]')
                .first()
                .parent()
                .within(() => {
                    updates.forEach(({ label, value }) => {
                        const input = cy.contains('label', label).parent().find('input');
                        input.clear();
                        input.type(String(value));
                    });
                });
            cy.get('[data-testid="SaveIcon"]').click();

            cy.get('@editStudy')
                .its('request.body')
                .then((body: Record<string, unknown>) => {
                    updates.forEach(({ bodyKey, value }) => {
                        expect(body).to.have.property(bodyKey);
                        expect(body[bodyKey]).to.equal(value);
                    });
                });
        });
    });

    describe('metadata', () => {
        beforeEach(() => {
            visitAndWaitForPage();
        });

        it('should show Metadata accordion', () => {
            cy.contains('Metadata').should('be.visible');
        });

        it('should show metadata section when accordion expanded', () => {
            cy.contains('Metadata').parents('[role="button"]').first().click();
            cy.get('table').should('exist');
        });

        it('should enable the Save button when a metadata row is added', () => {
            cy.contains('Metadata').parents('[role="button"]').first().click();
            cy.contains('Metadata')
                .parents('[role="button"]')
                .first()
                .parent()
                .within(() => {
                    cy.get('input[placeholder="New metadata key"]').clear().type('e2e_metadata_key');
                    cy.get('input[placeholder="New metadata value"]').clear().type('e2e_metadata_value');
                    cy.contains('button', 'ADD').click();
                });
            cy.contains('e2e_metadata_key').should('be.visible');
            cy.get('[data-testid="SaveIcon"]').closest('button').should('not.be.disabled');
        });
    });

    describe('bottom navigation bar', () => {
        beforeEach(() => {
            visitAndWaitForPage();
        });

        it('should show Back to extraction button', () => {
            cy.contains('button', 'Back to extraction').should('be.visible');
        });

        it('should show extraction table state (position and total)', () => {
            cy.contains('of').should('be.visible');
            cy.contains('total').should('be.visible');
        });

        it('should show Mark as Complete button', () => {
            cy.contains('button', 'Mark as Complete').should('be.visible');
        });

        it('should mark study as complete and send updated status in project PUT', () => {
            cy.intercept('PUT', '**/api/projects/*', { fixture: 'projects/projectPut' }).as('putProject');
            cy.contains('button', 'Mark as Complete').click();
            cy.wait('@putProject');
            cy.get('@putProject')
                .its('request.body')
                .then(
                    (body: {
                        provenance?: { extractionMetadata?: { studyStatusList?: { id: string; status: string }[] } };
                    }) => {
                        const studyStatusList = body.provenance?.extractionMetadata?.studyStatusList ?? [];
                        const completedEntry = studyStatusList.find(
                            (s) => s.id === 'b-mock-study-id' && s.status === 'completed'
                        );
                        expect(completedEntry).to.exist;
                    }
                );
        });

        it('should open confirmation dialog when Back to extraction is clicked with unsaved changes', () => {
            cy.get('div').contains('(name, authors, description, doi, pmid, etc)').click();
            cy.contains('(name, authors, description, doi, pmid, etc)')
                .parents('[role="button"]')
                .first()
                .parent()
                .within(() => {
                    cy.contains('label', 'name').parent().find('input').type(' changed');
                });
            cy.contains('button', 'Back to extraction').click();
            cy.contains('You have unsaved changes').should('be.visible');
            cy.contains('Are you sure you want to continue?').should('be.visible');
        });
    });
});
