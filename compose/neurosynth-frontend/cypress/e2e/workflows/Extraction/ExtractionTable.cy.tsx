/// <reference types="cypress" />

import { INeurosynthProjectReturn } from 'hooks/projects/useGetProjects';
import { StudyReturn, StudysetReturn } from 'neurostore-typescript-sdk';
import { IExtractionTableStudy } from 'pages/Extraction/components/ExtractionTable';

describe('ExtractionTable', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'Extraction/project',
        }).as('projectFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');

        cy.intercept('PUT', `**/api/projects/*`, { fixture: 'Extraction/project' }).as(
            'updateProjectFixture'
        );

        cy.intercept('GET', `**/api/studies/*`, { fixture: 'study' }).as('studyFixture');
        cy.intercept('GET', `**/api/annotations/*`, { fixture: 'annotation' }).as(
            'annotationsFixture'
        );

        cy.intercept('GET', `https://api.semanticscholar.org/**`, {
            fixture: 'semanticScholar',
        }).as('semanticScholarFixture');
    });

    describe('Filtering', () => {
        beforeEach(() => {
            cy.login('mocked').visit(`/projects/abc123/extraction`);
        });

        it('should filter the table by year', () => {
            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture?.response?.body as StudysetReturn;
                const studysetStudies = studyset.studies as StudyReturn[];
                cy.get('input').eq(0).click();
                cy.get(`input`)
                    .eq(0)
                    .type(studysetStudies[0].year?.toString() || '');
            });

            cy.get('tbody > tr').should('have.length', 1);
        });

        it('should filter the table by name', () => {
            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture?.response?.body as StudysetReturn;
                const studysetStudies = studyset.studies as StudyReturn[];
                cy.get('input').eq(1).click();
                cy.get(`input`)
                    .eq(1)
                    .type(studysetStudies[0].name || '');
            });

            cy.get('tbody > tr').should('have.length', 1);
        });

        it('should filter the table by author', () => {
            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture?.response?.body as StudysetReturn;
                const studysetStudies = studyset.studies as StudyReturn[];
                cy.get('input').eq(2).click();
                cy.get(`input`)
                    .eq(2)
                    .type(studysetStudies[0].authors || '');
            });

            cy.get('tbody > tr').should('have.length', 1);
        });

        it('should show available journals as options', () => {
            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture?.response?.body as StudysetReturn;
                const studysetStudies = studyset.studies as StudyReturn[];
                const uniqueJouranls = new Set<string>();
                studysetStudies.forEach((study) => {
                    if (study.publication) uniqueJouranls.add(study.publication);
                });
                cy.get('input').eq(3).click();
                cy.get('div[role="presentation"]').within(() => {
                    cy.get('li').should('have.length', uniqueJouranls.size);
                });
            });
        });

        it('should filter the table by journal', () => {
            cy.get('input').eq(3).click();
            cy.get('div[role="presentation"]').within((menu) => {
                cy.get('li').eq(0).click();
            });

            cy.get('tbody > tr').should('have.length', 1);
        });

        it('should filter the table by doi', () => {
            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture?.response?.body as StudysetReturn;
                const studysetStudies = studyset.studies as StudyReturn[];
                cy.get('input').eq(4).click();
                cy.get(`input`)
                    .eq(4)
                    .type(studysetStudies[0].doi || '');
            });

            cy.get('tbody > tr').should('have.length', 1);
        });

        it('should filter the table by pmid', () => {
            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture?.response?.body as StudysetReturn;
                const studysetStudies = studyset.studies as StudyReturn[];
                cy.get('input').eq(5).click();
                cy.get(`input`)
                    .eq(5)
                    .type(studysetStudies[0].pmid || '');
            });

            cy.get('tbody > tr').should('have.length', 1);
        });

        it('should filter the table by status', () => {
            cy.get('div[role="combobox"]').eq(0).click();
            cy.get('div[role="presentation"]').within(() => {
                // set to completed
                cy.get('li').eq(3).click();
            });

            cy.get('tbody > tr').should('have.length', 1);
        });

        it('should show filtering chips at the bottom if one or more filters are applied', () => {
            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture?.response?.body as StudysetReturn;
                const studysetStudies = studyset.studies as StudyReturn[];
                cy.get('input').eq(0).click();
                cy.get(`input`)
                    .eq(0)
                    .type(studysetStudies[0].year?.toString() || '');
                cy.get('input').eq(1).click();
                cy.get('input')
                    .eq(1)
                    .type(studysetStudies[0].name?.toString() || '');

                cy.contains(`Filtering YEAR: ${studysetStudies[0].year?.toString()}`).should(
                    'exist'
                );
                cy.contains(`Filtering NAME: ${studysetStudies[0].name?.toString()}`).should(
                    'exist'
                );
            });
        });

        it('should remove the filter if the delete button is clicked', () => {
            // ARRANGE
            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture?.response?.body as StudysetReturn;
                const studysetStudies = studyset.studies as StudyReturn[];
                cy.get('input').eq(0).click();
                cy.get(`input`)
                    .eq(0)
                    .type(studysetStudies[0].year?.toString() || '');
            });
            cy.get('tbody > tr').should('have.length', 1);
            cy.get('[data-testid="CancelIcon"]').should('exist');
            // ACT
            cy.get('[data-testid="CancelIcon"]').click();

            // ASSERT
            cy.get('tbody > tr').should('have.length', 3);
            cy.get(`[data-testid="CancelIcon"]`).should('not.exist');
        });
    });

    describe('status', () => {
        beforeEach(() => {
            cy.login('mocked').visit(`/projects/abc123/extraction`);
        });

        it('should change the study status', () => {
            // ARRANGE
            cy.get('tbody > tr').eq(0).get('td').eq(6).as('getFirstRowStudyStatusCol');
            cy.get('@getFirstRowStudyStatusCol').within(() => {
                cy.get('button').eq(0).should('have.class', 'MuiButton-contained');
            });

            // ACT
            cy.get('@getFirstRowStudyStatusCol').within(() => {
                cy.get('button').eq(1).click();
            });

            // ASSERT
            cy.get('@getFirstRowStudyStatusCol').within(() => {
                cy.get('button').eq(0).should('have.class', 'MuiButton-outlined');
                cy.get('button').eq(1).should('have.class', 'MuiButton-contained');
            });
        });
    });

    describe('sorting', () => {
        beforeEach(() => {
            cy.login('mocked').visit(`/projects/abc123/extraction`);
        });

        it('should sort by year desc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(0).click();

            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture.response?.body as StudysetReturn;
                const studies = [...(studyset.studies || [])] as StudyReturn[];

                const sortedStudies = studies.sort(
                    (a, b) => (b.year as number) - (a.year as number)
                );

                cy.get('tbody > tr').each((tr, index) => {
                    cy.wrap(tr).within(() => {
                        cy.get('td')
                            .eq(0)
                            .should('have.text', sortedStudies[index].year?.toString());
                    });
                });
            });
        });

        it('should sort by year asc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(0).click();
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(0).click();
            cy.get('[data-testid="ArrowUpwardIcon"]').should('exist');

            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture.response?.body as StudysetReturn;
                const studies = [...(studyset.studies || [])] as StudyReturn[];

                const sortedStudies = studies.sort(
                    (a, b) => (a.year as number) - (b.year as number)
                );

                cy.get('tbody > tr').each((tr, index) => {
                    cy.wrap(tr).within(() => {
                        cy.get('td')
                            .eq(0)
                            .should('have.text', sortedStudies[index].year?.toString());
                    });
                });
            });
        });

        it('should sort by name asc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(1).click();

            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture.response?.body as StudysetReturn;
                const studies = [...(studyset.studies || [])] as StudyReturn[];

                const sortedStudies = studies.sort((a, b) =>
                    (b.name as string).localeCompare(a.name as string)
                );

                console.log(sortedStudies);

                cy.get('tbody > tr').each((tr, index) => {
                    cy.wrap(tr).within(() => {
                        cy.get('td').eq(1).should('have.text', sortedStudies[index].name);
                    });
                });
            });
        });

        it('should sort by name desc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(1).click();
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(1).click();
            cy.get('[data-testid="ArrowUpwardIcon"]').should('exist');

            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture.response?.body as StudysetReturn;
                const studies = [...(studyset.studies || [])] as StudyReturn[];

                const sortedStudies = studies.sort((a, b) =>
                    (a.name as string).localeCompare(b.name as string)
                );

                cy.get('tbody > tr').each((tr, index) => {
                    cy.wrap(tr).within(() => {
                        cy.get('td').eq(1).should('have.text', sortedStudies[index].name);
                    });
                });
            });
        });

        it('should sort by authors desc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(2).click();

            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture.response?.body as StudysetReturn;
                const studies = [...(studyset.studies || [])] as StudyReturn[];

                const sortedStudies = studies.sort((a, b) =>
                    (b.authors as string).localeCompare(a.authors as string)
                );

                cy.get('tbody > tr').each((tr, index) => {
                    cy.wrap(tr).within(() => {
                        cy.get('td').eq(2).should('have.text', sortedStudies[index].authors);
                    });
                });
            });
        });

        it('should sort by authors asc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(2).click();
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(2).click();
            cy.get('[data-testid="ArrowUpwardIcon"]').should('exist');

            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture.response?.body as StudysetReturn;
                const studies = [...(studyset.studies || [])] as StudyReturn[];

                const sortedStudies = studies.sort((a, b) =>
                    (a.authors as string).localeCompare(b.authors as string)
                );

                cy.get('tbody > tr').each((tr, index) => {
                    cy.wrap(tr).within(() => {
                        cy.get('td').eq(2).should('have.text', sortedStudies[index].authors);
                    });
                });
            });
        });

        it('should sort by journal desc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(3).click();

            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture.response?.body as StudysetReturn;
                const studies = [...(studyset.studies || [])] as StudyReturn[];

                const sortedStudies = studies.sort((a, b) =>
                    (b.publication as string).localeCompare(a.publication as string)
                );

                cy.get('tbody > tr').each((tr, index) => {
                    cy.wrap(tr).within(() => {
                        cy.get('td').eq(3).should('have.text', sortedStudies[index].publication);
                    });
                });
            });
        });

        it('should sort by journal desc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(3).click();
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(3).click();
            cy.get('[data-testid="ArrowUpwardIcon"]').should('exist');

            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture.response?.body as StudysetReturn;
                const studies = [...(studyset.studies || [])] as StudyReturn[];

                const sortedStudies = studies.sort((a, b) =>
                    (a.publication as string).localeCompare(b.publication as string)
                );

                cy.get('tbody > tr').each((tr, index) => {
                    cy.wrap(tr).within(() => {
                        cy.get('td').eq(3).should('have.text', sortedStudies[index].publication);
                    });
                });
            });
        });

        it('should sort by doi desc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(4).click();

            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture.response?.body as StudysetReturn;
                const studies = [...(studyset.studies || [])] as StudyReturn[];

                const sortedStudies = studies.sort((a, b) =>
                    (b.doi as string).localeCompare(a.doi as string)
                );

                console.log(sortedStudies);

                cy.get('tbody > tr').each((tr, index) => {
                    cy.wrap(tr).within(() => {
                        cy.get('td').eq(4).should('have.text', sortedStudies[index].doi);
                    });
                });
            });
        });
        it('should sort by doi asc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(4).click();
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(4).click();
            cy.get('[data-testid="ArrowUpwardIcon"]').should('exist');

            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture.response?.body as StudysetReturn;
                const studies = [...(studyset.studies || [])] as StudyReturn[];

                const sortedStudies = studies.sort((a, b) =>
                    (a.doi as string).localeCompare(b.doi as string)
                );

                cy.get('tbody > tr').each((tr, index) => {
                    cy.wrap(tr).within(() => {
                        cy.get('td').eq(4).should('have.text', sortedStudies[index].doi);
                    });
                });
            });
        });

        it('should sort by pmid desc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(5).click();

            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture.response?.body as StudysetReturn;
                const studies = [...(studyset.studies || [])] as StudyReturn[];

                const sortedStudies = studies.sort((a, b) =>
                    (b?.pmid || '').localeCompare(a?.pmid || '', undefined, {
                        numeric: true,
                    })
                );

                console.log(sortedStudies);

                cy.get('tbody > tr').each((tr, index) => {
                    cy.wrap(tr).within(() => {
                        cy.get('td')
                            .eq(5)
                            .should('have.text', sortedStudies[index].pmid ?? '');
                    });
                });
            });
        });

        it('should sort by pmid asc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(5).click();
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(5).click();
            cy.get('[data-testid="ArrowUpwardIcon"]').should('exist');

            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture.response?.body as StudysetReturn;
                const studies = [...(studyset.studies || [])] as StudyReturn[];

                const sortedStudies = studies.sort((a, b) =>
                    (a?.pmid || '').localeCompare(b?.pmid || '', undefined, {
                        numeric: true,
                    })
                );

                cy.get('tbody > tr').each((tr, index) => {
                    cy.wrap(tr).within(() => {
                        cy.get('td')
                            .eq(5)
                            .should('have.text', sortedStudies[index].pmid ?? '');
                    });
                });
            });
        });

        it('should sort by status desc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(6).click();

            cy.wait('@projectFixture').then((projectFixture) => {
                const project = projectFixture?.response?.body as INeurosynthProjectReturn;
                const studyStatusList = project.provenance.extractionMetadata.studyStatusList;

                cy.wait('@studysetFixture').then((studysetFixture) => {
                    const studyset = studysetFixture.response?.body as StudysetReturn;
                    const studies = [...(studyset.studies || [])] as StudyReturn[];

                    const sortedStudies: IExtractionTableStudy[] = studies
                        .map((study) => ({
                            ...study,
                            status: studyStatusList.find((status) => status.id === study.id)
                                ?.status,
                        }))
                        .sort((a, b) =>
                            (a?.status || '').localeCompare(b?.status || '', undefined, {
                                numeric: true,
                            })
                        );

                    cy.get('tbody > tr').each((tr, index) => {
                        cy.wrap(tr).within(() => {
                            cy.get('td')
                                .eq(6)
                                .within(() => {
                                    const studyStatus = sortedStudies[index].status;
                                    const buttonIndex =
                                        studyStatus === 'completed'
                                            ? 2
                                            : studyStatus === 'savedforlater'
                                            ? 1
                                            : 0;

                                    cy.get('button').each((button, index) => {
                                        if (index === buttonIndex) {
                                            cy.wrap(button).should(
                                                'have.class',
                                                'MuiButton-contained'
                                            );
                                        } else {
                                            cy.wrap(button).should(
                                                'have.class',
                                                'MuiButton-outlined'
                                            );
                                        }
                                    });
                                });
                        });
                    });
                });
            });
        });

        it('should sort by status asc', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(6).click();
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(6).click();
            cy.get('[data-testid="ArrowUpwardIcon"]').should('exist');

            cy.wait('@projectFixture').then((projectFixture) => {
                const project = projectFixture?.response?.body as INeurosynthProjectReturn;
                const studyStatusList = project.provenance.extractionMetadata.studyStatusList;

                cy.wait('@studysetFixture').then((studysetFixture) => {
                    const studyset = studysetFixture.response?.body as StudysetReturn;
                    const studies = [...(studyset.studies || [])] as StudyReturn[];

                    const sortedStudies: IExtractionTableStudy[] = studies
                        .map((study) => ({
                            ...study,
                            status: studyStatusList.find((status) => status.id === study.id)
                                ?.status,
                        }))
                        .sort((a, b) =>
                            (b?.status || '').localeCompare(a?.status || '', undefined, {
                                numeric: true,
                            })
                        );

                    cy.get('tbody > tr').each((tr, index) => {
                        cy.wrap(tr).within(() => {
                            cy.get('td')
                                .eq(6)
                                .within(() => {
                                    const studyStatus = sortedStudies[index].status;
                                    const buttonIndex =
                                        studyStatus === 'completed'
                                            ? 2
                                            : studyStatus === 'savedforlater'
                                            ? 1
                                            : 0;

                                    cy.get('button').each((button, index) => {
                                        if (index === buttonIndex) {
                                            cy.wrap(button).should(
                                                'have.class',
                                                'MuiButton-contained'
                                            );
                                        } else {
                                            cy.wrap(button).should(
                                                'have.class',
                                                'MuiButton-outlined'
                                            );
                                        }
                                    });
                                });
                        });
                    });
                });
            });
        });
    });

    describe('pagination', () => {
        beforeEach(() => {
            cy.fixture('studyset').then((studyset) => {
                // as we are artificially creating new studies below, the out of sync popup wil appear. That's expected and
                // we can just ignore it during out test
                console.log(studyset);
                const studies = [];
                for (let i = 0; i < 100; i++) {
                    studies.push(...(studyset?.studies as StudyReturn[]));
                }
                studyset.studies = studies;
                console.log(studyset);
                cy.intercept('GET', `**/api/studysets/*`, studyset).as('studysetFixture');
            });
        });

        beforeEach(() => {
            cy.login('mocked').visit(`/projects/abc123/extraction`);
        });

        it('should give the correct number of studies', () => {
            cy.wait('@studysetFixture').then((studysetFixture) => {
                const studyset = studysetFixture.response?.body as StudysetReturn;
                cy.contains(`Total: ${studyset.studies?.length} studies`).should('exist');
            });
        });

        it('should change the number of rows per page', () => {
            cy.get('[role="combobox"]').eq(2).click();
            cy.get('div[role="presentation"]').within(() => {
                cy.contains('10').click();
            });
            cy.get('tbody > tr').should('have.length', 10);
            cy.get('.MuiPaginationItem-root').contains('30');

            cy.get('[role="combobox"]').eq(2).click();
            cy.get('div[role="presentation"]').within(() => {
                cy.contains('25').click();
            });
            cy.get('tbody > tr').should('have.length', 25);
            cy.get('.MuiPaginationItem-root').contains('12');

            cy.get('[role="combobox"]').eq(2).click();
            cy.get('div[role="presentation"]').within(() => {
                cy.contains('50').click();
            });
            cy.get('tbody > tr').should('have.length', 50);

            cy.get('[role="combobox"]').eq(2).click();
            cy.get('div[role="presentation"]').within(() => {
                cy.contains('100').click();
            });
            cy.get('tbody > tr').should('have.length', 100);
            cy.get('.MuiPaginationItem-root').contains('3');
        });
    });

    describe('navigation', () => {
        beforeEach(() => {
            cy.login('mocked').visit(`/projects/abc123/extraction`);
        });

        it('should navigate to the selected study with the saved table state', () => {
            cy.get('tbody > tr').eq(0).click();
            cy.url().should('include', `/projects/abc123/extraction/studies/3Jvrv4Pct3hb/edit`);

            cy.window().then((window) => {
                const item = window.sessionStorage.getItem(`abc123-extraction-table`);
                cy.wrap(item).should('exist');
            });
        });

        it('should keep the table state', () => {
            cy.get('tbody > tr').eq(0).click();
            cy.url().should('include', `/projects/abc123/extraction/studies/3Jvrv4Pct3hb/edit`);

            cy.visit(`/projects/abc123/extraction`);

            cy.window().then((window) => {
                const item = window.sessionStorage.getItem(`abc123-extraction-table`);
                cy.wrap(item).should('exist');
            });
        });

        it('should save the filter and sorting to the table state', () => {
            cy.get('[data-testid="ArrowDownwardIcon"]').eq(0).click(); // click on year sort
            cy.get('input').eq(1).click();
            cy.get(`input`).eq(1).type('Activation');

            // we wait because of the debounce
            // eslint-disable-next-line cypress/no-unnecessary-waiting
            cy.wait(800);

            cy.get('tbody > tr').eq(0).click();

            cy.window().then((window) => {
                const state = window.sessionStorage.getItem(`abc123-extraction-table`);
                const parsedState = JSON.parse(state || '{}');

                cy.wrap(parsedState).should('deep.equal', {
                    columnFilters: [{ id: 'name', value: 'Activation' }],
                    sorting: [{ id: 'year', desc: true }],
                    studies: ['3zutS8kyg2sy'],
                });
            });
        });
    });
});
