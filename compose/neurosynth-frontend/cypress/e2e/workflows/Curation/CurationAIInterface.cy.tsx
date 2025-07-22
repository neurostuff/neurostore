import { INeurosynthProject, INeurosynthProjectReturn } from 'hooks/projects/useGetProjects';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { defaultExclusionTags } from 'pages/Project/store/ProjectStore.types';

describe('CurationAIInterface', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'projects/projectCurationSimpleWithStudies',
        }).as('projectFixture');

        cy.intercept(
            {
                method: 'PUT',
                url: `**/api/projects/*`,
            },
            {}
        ).as('updateProject');

        cy.intercept('GET', `**/api/pipeline-study-results/?feature_display=TaskExtractor*`, {
            fixture: 'pipeline-results/TaskExtraction',
        }).as('participantDemographicsExtraction');

        cy.intercept('GET', `**/api/pipeline-study-results/?feature_display=ParticipantDemographicsExtractor*`, {
            fixture: 'pipeline-results/ParticipantDemographicsExtraction',
        }).as('taskExtraction');

        // this is necessary to hide an info popup that appears for the first time in projects for the new curation UI
        // the auth0
        cy.addToLocalStorage('auth0|62e0e6c9dd47048572613b4d-hide-info-popup', 'true');

        // cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
    });

    it('should load the page', () => {
        cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
    });

    describe('old vs new interface', () => {
        it('should default to the old interface if created before may 30 2025 (TODO: remove this test when we migrate to new interface)', () => {
            cy.fixture('projects/projectCurationPRISMAWithStudies').then((projectFixture) => {
                cy.intercept('GET', '**/api/projects/*', {
                    ...projectFixture,
                    created_at: new Date('2025-05-29'),
                } as INeurosynthProjectReturn).as('projectFixture');
            });

            // Visit the page
            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');

            cy.contains('Switch to New Interface').should('exist');
        });

        it('should default to the new interface if created after may 30 2025', () => {
            cy.fixture('projects/projectCurationPRISMAWithStudies').then((projectFixture) => {
                cy.intercept('GET', '**/api/projects/*', {
                    ...projectFixture,
                    created_at: new Date('2025-06-01'), // after May 30
                }).as('projectFixture');
            });

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');

            cy.contains('Switch to Old Interface').should('exist');
        });

        it('should show the new interface if localStorage overrides the date check', () => {
            cy.addToLocalStorage('show-new-ui-may-30-2025', 'true');

            cy.fixture('projects/projectCurationPRISMAWithStudies').then((projectFixture) => {
                cy.intercept('GET', '**/api/projects/*', {
                    ...projectFixture,
                    created_at: new Date('2025-05-29'), // This would normally trigger the new UI
                }).as('projectFixture');
            });

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');

            cy.contains('Switch to Old Interface').should('exist');
        });

        it('should show the old interface if localStorage overrides the date check', () => {
            cy.addToLocalStorage('show-new-ui-may-30-2025', 'false');

            cy.fixture('projects/projectCurationPRISMAWithStudies').then((projectFixture) => {
                cy.intercept('GET', '**/api/projects/*', {
                    ...projectFixture,
                    created_at: new Date('2025-05-29'), // This would normally trigger the new UI
                }).as('projectFixture');
            });

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');

            cy.contains('Switch to New Interface').should('exist');
        });
    });

    describe('new interface PRISMA layout', () => {
        beforeEach(() => {
            // switch to new interfae
            cy.addToLocalStorage('show-new-ui-may-30-2025', 'true');
            cy.intercept('GET', `**/api/projects/*`, {
                fixture: 'projects/projectCurationPRISMAWithStudies',
            }).as('projectFixture');
            // cy.fixture('projects/projectCurationPRISMAWithStudies').as('projectFixture');
            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');

            cy.wait('@taskExtraction');
            cy.wait('@participantDemographicsExtraction');
        });

        it('should have the discrete PRISMA phases: identification, screening, eligibility and included', () => {
            // Confirm the main PRISMA phases are rendered in the left sidebar
            cy.contains('1. Identification').should('exist');
            cy.contains('2. Screening').should('exist');
            cy.contains('3. Eligibility').should('exist');
            cy.contains('4. Included').should('exist');
        });

        it('should have a promote non duplicated studies button', () => {
            cy.contains('Promote Non Duplicated Studies').should('exist');
        });

        it('should have a button to show the PRISMA diagram', () => {
            cy.contains('PRISMA diagram').should('exist');
        });

        it('should have a button to download the CSVs in the included phase', () => {
            cy.contains('4. Included').click();
            cy.contains('Download as CSV').should('exist');
        });

        it('should have the duplicate phase as a default phase in identification', () => {
            cy.contains('li', '1. Identification').next().contains('Duplicate').should('exist');
        });

        it('should have nested excluded menu items for eligibility', () => {
            cy.contains('li', '2. Screening').next().contains('Excluded');
            cy.contains('li', '2. Screening').next().find('[data-testid="KeyboardArrowRightIcon"]').should('exist');
        });

        it('should have nested excluded menu items for screening', () => {
            cy.contains('li', '3. Eligibility').next().contains('Excluded');
            cy.contains('li', '3. Eligibility').next().find('[data-testid="KeyboardArrowRightIcon"]').should('exist');
        });

        describe('table mode', () => {
            it('should only show the basic, non-AI options in the manage columns dropdown for the identification phase', () => {
                cy.contains('button', 'Columns').click();
                cy.get('.base-Popper-root').should('exist').and('not.contain', 'AI');
            });

            it('should show the correct button options when a row is selected', () => {
                cy.contains('button', /^Promote$/).should('not.exist');
                cy.contains('button', 'Duplicate (1)').should('not.exist');

                cy.get('.MuiCheckbox-root').eq(1).click();

                // check the button options in identification
                cy.contains('button', 'Promote (1)').should('exist');
                cy.contains('button', 'Duplicate (1)').should('exist');
                cy.contains('button', 'Demote (1)').should('not.exist');

                // promote study and go to screening
                cy.contains('button', 'Promote (1)').click();
                cy.contains('li', '2. Screening').click();
                cy.get('.MuiCheckbox-root').eq(1).click();

                // check the button options in screening
                cy.contains('button', 'Promote (1)').should('exist');
                cy.contains('button', 'Irrelevant (1)').should('exist');
                cy.contains('button', 'Demote (1)').should('exist');

                // promote study and go to eligibility
                cy.contains('button', 'Promote (1)').click();
                cy.contains('li', '3. Eligibility').click();
                cy.get('.MuiCheckbox-root').eq(1).click();

                // check the button options in eligibility
                cy.contains('button', 'Include (1)').should('exist');
                cy.contains('button', 'Out of scope (1)').should('exist');
                cy.contains('button', 'Demote (1)').should('exist');
            });
        });

        describe('focus mode', () => {
            it('should show the include button as PROMOTE in the identification phase and not demote', () => {
                cy.contains('li', '1. Identification').click();

                cy.get('tr').eq(1).click({ force: true });
                cy.contains('Promote').should('exist');
                cy.contains('Demote').should('not.exist');
            });

            it('should show the include button as PROMOTE in the screening phase and demote', () => {
                // select an option and move it to screening
                cy.contains('li', '1. Identification').click();
                cy.get('tr').eq(1).click({ force: true });
                cy.contains(/^Promote$/).click();

                cy.contains('li', '2. Screening').click();

                cy.contains('Promote').should('exist');
                cy.contains('Demote').should('exist');
            });

            it('should show the include button as INCLUDE in the eligibility phase', () => {
                // select an option and move it to screening and then move it to eligibility
                cy.contains('li', '1. Identification').click();
                cy.get('tr').eq(1).click({ force: true });
                cy.contains(/^Promote$/).click();

                cy.contains('li', '2. Screening').click();
                cy.contains('Promote').click();

                cy.contains('li', '3. Eligibility').click();

                cy.contains(/^Include$/).should('exist');
                cy.contains('Promote').should('not.exist');
                cy.contains('Demote').should('exist');
            });

            it('should not show the include button in the included phase', () => {
                // select an option and move it to screening and then move it to eligibility and then move it to included
                cy.contains('li', '1. Identification').click();
                cy.get('tr').eq(1).click({ force: true });
                cy.contains(/^Promote$/).click();

                cy.contains('li', '2. Screening').click();
                cy.contains('Promote').click();

                cy.contains('li', '3. Eligibility').click();
                cy.contains(/^Include$/).click();

                cy.contains('li', '4. Included').click();

                cy.contains(/^Include$/).should('not.exist');
                cy.contains('Promote').should('not.exist');
                cy.contains('Demote').should('not.exist');
            });
        });
    });

    describe('new interface PRISMA no data', () => {
        it('should show "No studies. To import studies..."', () => {
            cy.intercept('GET', `**/api/projects/*`, {
                fixture: 'projects/projectCurationEmptyPRISMA',
            }).as('projectFixture');

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');
            cy.contains('No studies. To import studies, click the import button above').should('exist');
        });

        it('should show "No studies to review for..."', () => {
            cy.fixture('projects/projectCurationPRISMAWithStudies').then((projectFixture: INeurosynthProjectReturn) => {
                // move all the stub studies from the first column to the second and clear the first
                projectFixture.provenance.curationMetadata.columns[1].stubStudies =
                    projectFixture.provenance.curationMetadata.columns[0].stubStudies;
                projectFixture.provenance.curationMetadata.columns[0].stubStudies = [];
                cy.intercept('GET', '**/api/projects/*', {
                    ...projectFixture,
                } as INeurosynthProjectReturn).as('projectFixture');
            });

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');
            cy.contains('No studies to review for identification').should('exist');
        });

        it('should show "No included studies..."', () => {
            cy.intercept('GET', `**/api/projects/*`, {
                fixture: 'projects/projectCurationPRISMAWithStudies',
            }).as('projectFixture');

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');
            cy.contains('li', '4. Included').click();
            cy.contains('No included studies').should('exist');
        });

        it('should show "You\'ve reviewed all the uncategorized studies!"', () => {
            cy.fixture('projects/projectCurationPRISMAWithStudies').then((projectFixture: INeurosynthProjectReturn) => {
                // move all the stub studies from the first column to the included column
                projectFixture.provenance.curationMetadata.columns[3].stubStudies =
                    projectFixture.provenance.curationMetadata.columns[0].stubStudies;
                projectFixture.provenance.curationMetadata.columns[0].stubStudies = [];
                cy.intercept('GET', '**/api/projects/*', {
                    ...projectFixture,
                } as INeurosynthProjectReturn).as('projectFixture');
            });

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');

            cy.contains('li', '1. Identification').click();
            cy.contains("You've reviewed all uncategorized studies in identification!").should('exist');
            cy.contains('li', '2. Screening').click();
            cy.contains("You've reviewed all uncategorized studies in screening!").should('exist');
            cy.contains('li', '3. Eligibility').click();
            cy.contains("You've reviewed all uncategorized studies in eligibility!").should('exist');
        });
    });

    describe('new interface simple workflow layout', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/projects/*`, {
                fixture: 'projects/projectCurationEmptySimple',
            }).as('projectFixture');

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');
        });

        it('should have two phases: unreviewed and included', () => {
            cy.contains('li', '1. Unreviewed').should('exist');
            cy.contains('li', '2. Included').should('exist');
        });

        it('should have excluded studies be a nested menu', () => {
            cy.contains('li', '1. Unreviewed').next().find('[data-testid="KeyboardArrowRightIcon"]').should('exist');
        });

        it('should show the import studies button', () => {
            cy.contains('button', 'import studies').should('exist');
        });

        it('should show the skip curation button', () => {
            cy.contains('button', 'Skip Curation').should('exist');
        });
    });

    describe('new interface simple no data', () => {
        it('should show "No studies. To import studies..."', () => {
            cy.intercept('GET', `**/api/projects/*`, {
                fixture: 'projects/projectCurationEmptySimple',
            }).as('projectFixture');

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');
            cy.contains('No studies. To import studies, click the import button above').should('exist');
        });

        it('should show "no included studies"', () => {
            cy.intercept('GET', `**/api/projects/*`, {
                fixture: 'projects/projectCurationSimpleWithStudies',
            }).as('projectFixture');

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');
            cy.contains('li', '2. Included').click();
            cy.contains('No included studies.').should('exist');
        });

        it('should show "You\'ve reviewed all the uncategorized studies!"', () => {
            cy.fixture('projects/projectCurationSimpleWithStudies').then((projectFixture: INeurosynthProjectReturn) => {
                // move all the stub studies from the first column to the second and clear the first
                projectFixture.provenance.curationMetadata.columns[1].stubStudies =
                    projectFixture.provenance.curationMetadata.columns[0].stubStudies;
                projectFixture.provenance.curationMetadata.columns[0].stubStudies = [];
                cy.intercept('GET', '**/api/projects/*', {
                    ...projectFixture,
                } as INeurosynthProjectReturn).as('projectFixture');
            });

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');
            cy.contains("You've reviewed all the uncategorized studies!").should('exist');
        });
    });

    describe('new interface workflow', () => {
        it('should switch between table and focus views', () => {
            cy.intercept('GET', `**/api/projects/*`, {
                fixture: 'projects/projectCurationSimpleWithStudies',
            }).as('projectFixture');

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');

            cy.wait('@taskExtraction');
            cy.wait('@participantDemographicsExtraction');

            cy.get('tr').eq(1).click();
            cy.contains('button', 'columns').should('not.exist');
            cy.contains('button', 'back to table view').should('exist');

            cy.contains('button', 'back to table view').click();
            cy.get('table').should('exist');
        });

        describe('table', () => {
            it('should not have checkboxes for the included phase', () => {
                cy.fixture('projects/projectCurationSimpleWithStudies').then(
                    (projectFixture: INeurosynthProjectReturn) => {
                        // move all the stub studies from the first column to the second and clear the first
                        projectFixture.provenance.curationMetadata.columns[1].stubStudies =
                            projectFixture.provenance.curationMetadata.columns[0].stubStudies;
                        projectFixture.provenance.curationMetadata.columns[0].stubStudies = [];
                        cy.intercept('GET', '**/api/projects/*', {
                            ...projectFixture,
                        } as INeurosynthProjectReturn).as('projectFixture');
                    }
                );
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');

                cy.contains('li', '2. Included').click();
                cy.get('.MuiCheckbox-root').should('not.exist');
            });

            it('should show the actions when a row is selected', () => {
                cy.intercept('GET', '**/api/projects/*', {
                    fixture: 'projects/projectCurationSimpleWithStudies',
                }).as('projectFixture');

                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');
                cy.contains('button', 'Include (1)').should('not.exist');
                cy.contains('button', 'Exclude (1)').should('not.exist');

                cy.get('.MuiCheckbox-root').eq(1).click();

                cy.contains('button', 'Include (1)').should('exist');
                cy.contains('button', 'Exclude (1)').should('exist');
            });

            it('should show the promote button but not the demote button in the identification phase for PRISMA', () => {
                cy.intercept('GET', '**/api/projects/*', {
                    fixture: 'projects/projectCurationPRISMAWithStudies',
                }).as('projectFixture');

                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');

                cy.get('.MuiCheckbox-root').eq(1).click();

                cy.contains('button', 'Promote (1)').should('exist');
                cy.contains('button', 'Duplicate (1)').should('exist');
                cy.contains('button', 'Demote (1)').should('not.exist');
            });

            it('should show the PROMOTE and the DEMOTE button in the screening phase for PRISMA', () => {
                cy.fixture('projects/projectCurationPRISMAWithStudies').then(
                    (projectFixture: INeurosynthProjectReturn) => {
                        // move all the stub studies from the first column to the second and clear the first
                        projectFixture.provenance.curationMetadata.columns[1].stubStudies =
                            projectFixture.provenance.curationMetadata.columns[0].stubStudies;
                        projectFixture.provenance.curationMetadata.columns[0].stubStudies = [];
                        cy.intercept('GET', '**/api/projects/*', {
                            ...projectFixture,
                        } as INeurosynthProjectReturn).as('projectFixture');
                    }
                );
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');

                cy.contains('li', '2. Screening').click();

                cy.get('.MuiCheckbox-root').eq(1).click();

                cy.contains('button', 'Promote (1)').should('exist');
                cy.contains('button', 'Irrelevant (1)').should('exist');
                cy.contains('button', 'Demote (1)').should('exist');
            });

            it('should show the INCLUDE and the DEMOTE button in the eligibility phase for PRISMA', () => {
                cy.fixture('projects/projectCurationPRISMAWithStudies').then(
                    (projectFixture: INeurosynthProjectReturn) => {
                        // move all the stub studies from the first column to the second and clear the first
                        projectFixture.provenance.curationMetadata.columns[2].stubStudies =
                            projectFixture.provenance.curationMetadata.columns[0].stubStudies;
                        projectFixture.provenance.curationMetadata.columns[0].stubStudies = [];
                        cy.intercept('GET', '**/api/projects/*', {
                            ...projectFixture,
                        } as INeurosynthProjectReturn).as('projectFixture');
                    }
                );

                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');

                cy.contains('li', '3. Eligibility').click();
                cy.get('.MuiCheckbox-root').eq(1).click();

                cy.contains('button', 'Include (1)').should('exist');
                cy.contains('button', 'Out of scope').should('exist');
                cy.contains('button', 'Demote').should('exist');
            });

            it('should show the number of studies selected', () => {
                cy.fixture('projects/projectCurationPRISMAWithStudies').then(
                    (projectFixture: INeurosynthProjectReturn) => {
                        // move all the stub studies from the first column to the second and clear the first
                        projectFixture.provenance.curationMetadata.columns[1].stubStudies =
                            projectFixture.provenance.curationMetadata.columns[0].stubStudies;
                        projectFixture.provenance.curationMetadata.columns[0].stubStudies = [];
                        cy.intercept('GET', '**/api/projects/*', {
                            ...projectFixture,
                        } as INeurosynthProjectReturn).as('projectFixture');
                    }
                );
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');

                cy.contains('li', '2. Screening').click();

                cy.get('.MuiCheckbox-root').eq(1).click();
                cy.get('.MuiCheckbox-root').eq(2).click();
                cy.get('.MuiCheckbox-root').eq(3).click();

                cy.contains('button', 'Promote (3)').should('exist');
                cy.contains('button', 'Irrelevant (3)').should('exist');
                cy.contains('button', 'Demote (3)').should('exist');
            });

            it('should clear the selection when the group is changed', () => {
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');
                cy.get('.MuiCheckbox-root').eq(1).click();
                cy.get('.MuiCheckbox-root.Mui-checked').should('exist');

                cy.contains('li', '2. Included').click();
                cy.contains('li', '1. Unreviewed').click();

                cy.get('.MuiCheckbox-root.Mui-checked').should('not.exist');
            });

            it('should promote multiple studies', () => {
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');

                cy.get('.MuiCheckbox-root').eq(1).click();
                cy.get('.MuiCheckbox-root').eq(2).click();
                cy.contains('button', 'Include (2)').click();
                cy.get('tr').should('have.length', 3); // originally 4 studies, now 2 studies left plus header row
            });

            it('should skip curation', () => {
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');
                cy.contains('Skip Curation').click();
                cy.contains('button', 'Continue').click();
                cy.contains('li', '1. Unreviewed').click();
                cy.get('tr').should('have.length', 1);
            });

            it('should move to the next group after skip curation', () => {
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');
                cy.contains('Skip Curation').click();
                cy.contains('button', 'Continue').click();
                cy.contains('li', '2. Included').find('.Mui-selected').should('exist');
            });

            it('should promote all uncategorized studies', () => {
                cy.intercept('GET', `**/api/projects/*`, {
                    fixture: 'projects/projectCurationPRISMAWithStudies',
                }).as('projectFixture');

                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');
                cy.contains('button', 'Promote Non Duplicated Studies').click();
                cy.contains('button', 'Continue').click();
                cy.get('tr').should('have.length', 1);
            });

            it('should exclude the study', () => {
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');
                cy.wait('@taskExtraction');
                cy.wait('@participantDemographicsExtraction');

                cy.get('tr').eq(1).click();
                cy.contains('button', 'Exclude').click();
                cy.contains('li', 'Excluded').find('.MuiChip-label').should('have.text', 1);
            });

            it('should create a new exclusion and then exclude the study', () => {
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@taskExtraction');
                cy.wait('@participantDemographicsExtraction');

                // go to first row and click exclude
                cy.get('tr').eq(1).click();
                cy.contains('button', 'Exclude').next().click();

                // open exclude popup and create new exclusion
                cy.contains('label', 'reason to exclude').click({ force: true });
                cy.contains('label', 'reason to exclude').type('some new exclusion reason');
                cy.contains('li', 'Add "some new exclusion reason"').click();

                // check that the excluded study has been removed from the total number
                // check that the new exclusion reason has been added
                cy.contains('li', 'Unreviewed').find('.MuiChip-label').should('have.text', 3);
                cy.contains('li', 'Excluded').click();
                cy.contains('li', 'some new exclusion reason').should('exist');
            });

            it('should exclude multiple studies', () => {
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');

                cy.get('.MuiCheckbox-root').eq(1).click();
                cy.get('.MuiCheckbox-root').eq(2).click();
                cy.contains('button', 'Exclude (2)').next().click();

                // open exclude popup and create new exclusion
                cy.contains('label', 'reason to exclude').click({ force: true });
                cy.contains('label', 'reason to exclude').type('some new exclusion reason');
                cy.contains('li', 'Add "some new exclusion reason"').click();

                // check that the excluded study has been removed from the total number
                // check that the new exclusion reason has been added
                cy.contains('li', 'Unreviewed').find('.MuiChip-label').should('have.text', 2);
                cy.contains('li', 'Excluded').click();
                cy.contains('li', 'some new exclusion reason').should('exist');

                cy.contains('li', 'some new exclusion reason').find('.MuiChip-label').should('have.text', 2);
            });

            it('should move demote multiple studies', () => {
                cy.fixture('projects/projectCurationPRISMAWithStudies').then(
                    (projectFixture: INeurosynthProjectReturn) => {
                        projectFixture.provenance.curationMetadata.columns[1].stubStudies =
                            projectFixture.provenance.curationMetadata.columns[0].stubStudies;
                        projectFixture.provenance.curationMetadata.columns[0].stubStudies = [];

                        cy.intercept('GET', '**/api/projects/*', {
                            ...projectFixture,
                        } as INeurosynthProjectReturn).as('projectFixture');
                    }
                );
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');

                cy.contains('li', '2. Screening').click();

                cy.get('.MuiCheckbox-root').eq(1).click();
                cy.get('.MuiCheckbox-root').eq(2).click();

                cy.contains('li', '1. Identification').find('.MuiChip-label').should('have.text', 0);
                cy.contains('Demote (2)').click();
                cy.contains('li', '1. Identification').click();
                cy.get('tr').should('have.length', 3);
                cy.contains('li', '1. Identification').find('.MuiChip-label').should('have.text', 2);
            });

            it('should add a column', () => {
                cy.addToLocalStorage(
                    'abc123-curation-table',
                    `{"firstTimeSeeingPage":false,"selectedColumns":[],"columnFilters":[],"sorting":[]}`
                );
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');
                cy.contains('Title').should('not.exist');
                cy.contains('button', 'Columns').click();
                cy.contains('li', 'Title').click();
                cy.contains('Title').should('exist');
            });

            it('should remove a column', () => {
                cy.addToLocalStorage(
                    'abc123-curation-table',
                    `{"firstTimeSeeingPage":false,"selectedColumns":["modality"],"columnFilters":[],"sorting":[]}`
                );
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');
                cy.contains('Modality').should('exist');
                cy.get('[data-testid="DeleteIcon"]').click();
                cy.contains('Modality').should('not.exist');
            });

            it('should filter studies via free text', () => {
                cy.addToLocalStorage(
                    'abc123-curation-table',
                    `{"firstTimeSeeingPage":false,"selectedColumns":["title"],"columnFilters":[],"sorting":[]}`
                );

                cy.intercept('GET', '**/api/projects/*', {
                    fixture: 'projects/projectCurationSimpleWithStudies',
                }).as('projectFixture');

                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');
                cy.get('tr').should('have.length', 5); // 4 plus header
                cy.get(`[data-testid="FilterListIcon"]`).click();
                cy.get('input[type="text"]').type('major depression');
                cy.get('tr').should('have.length', 2);
            });

            it('should filter studies via autocomplete and implement the SOME array compare strategy', () => {
                cy.addToLocalStorage(
                    'abc123-curation-table',
                    `{"firstTimeSeeingPage":false,"selectedColumns":["fMRITasks.TaskName"],"columnFilters":[],"sorting":[]}`
                );

                cy.intercept('GET', '**/api/projects/*', {
                    fixture: 'projects/projectCurationSimpleWithStudies',
                }).as('projectFixture');

                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');

                cy.get('tr').should('have.length', 5); // 4 plus header
                cy.get(`[data-testid="FilterListIcon"]`).click();
                cy.get('input[placeholder="filter"]').type('virtual reality');
                cy.contains('li', 'Virtual Reality').click();
                cy.get('tr').should('have.length', 2);
                cy.get('input[placeholder="filter"]').type('symbol match');
                cy.contains('li', 'Symbol Match').click();
                cy.get('tr').should('have.length', 3);
            });

            it('should sort studies', () => {
                cy.addToLocalStorage(
                    'abc123-curation-table',
                    `{"firstTimeSeeingPage":false,"selectedColumns":["title"],"columnFilters":[],"sorting":[]}`
                );

                cy.intercept('GET', '**/api/projects/*', {
                    fixture: 'projects/projectCurationSimpleWithStudies',
                }).as('projectFixture');

                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');

                cy.fixture('projects/projectCurationSimpleWithStudies').then((data: INeurosynthProject) => {
                    data.provenance.curationMetadata.columns[0].stubStudies.forEach((study, index) => {
                        cy.get('tr')
                            .eq(index + 1)
                            .find('td')
                            .eq(2)
                            .should('have.text', study.title);
                    });
                });

                // sort column
                cy.get(`[data-testid="ArrowDownwardIcon"]`).click();

                cy.fixture('projects/projectCurationSimpleWithStudies').then((data: INeurosynthProject) => {
                    data.provenance.curationMetadata.columns[0].stubStudies
                        .sort((a, b) => b.title.localeCompare(a.title))
                        .forEach((study, index) => {
                            cy.get('tr')
                                .eq(index + 1)
                                .find('td')
                                .eq(2)
                                .should('have.text', study.title);
                        });
                });
            });
        });

        describe('focus', () => {
            it('should move the study from identification to screening, eligibility, and then included', () => {
                cy.intercept('GET', '**/api/projects/*', {
                    fixture: 'projects/projectCurationPRISMAWithStudies',
                }).as('projectFixture');

                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');
                cy.wait('@taskExtraction');
                cy.wait('@participantDemographicsExtraction');

                cy.contains('li', '1. Identification').find('.MuiChip-label').should('have.text', 80);
                cy.contains('li', '2. Screening').find('.MuiChip-label').should('have.text', 0);
                cy.contains('li', '3. Eligibility').find('.MuiChip-label').should('have.text', 0);
                cy.contains('li', '4. Included').find('.MuiChip-label').should('have.text', 0);

                cy.contains('li', '1. Identification').click();
                cy.get('tr').eq(1).click({ force: true });
                cy.contains('button', /^Promote$/).click();

                cy.contains('li', '1. Identification').find('.MuiChip-label').should('have.text', 79);
                cy.contains('li', '2. Screening').find('.MuiChip-label').should('have.text', 1);
                cy.contains('li', '3. Eligibility').find('.MuiChip-label').should('have.text', 0);
                cy.contains('li', '4. Included').find('.MuiChip-label').should('have.text', 0);

                cy.contains('li', '2. Screening').click();
                cy.contains('button', /^Promote$/).click();

                cy.contains('li', '1. Identification').find('.MuiChip-label').should('have.text', 79);
                cy.contains('li', '2. Screening').find('.MuiChip-label').should('have.text', 0);
                cy.contains('li', '3. Eligibility').find('.MuiChip-label').should('have.text', 1);
                cy.contains('li', '4. Included').find('.MuiChip-label').should('have.text', 0);

                cy.contains('li', '3. Eligibility').click();
                cy.contains('button', /^Include$/).click();

                cy.contains('li', '1. Identification').find('.MuiChip-label').should('have.text', 79);
                cy.contains('li', '2. Screening').find('.MuiChip-label').should('have.text', 0);
                cy.contains('li', '3. Eligibility').find('.MuiChip-label').should('have.text', 0);
                cy.contains('li', '4. Included').find('.MuiChip-label').should('have.text', 1);
            });

            it('should exclude the study', () => {
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');
                cy.wait('@taskExtraction');
                cy.wait('@participantDemographicsExtraction');

                cy.contains('li', '1. Unreviewed').click();
                cy.get('tr').eq(1).click({ force: true });
                cy.contains('button', /^Exclude$/).click();
                cy.contains('li', 'Excluded').find('.MuiChip-label').should('have.text', 1);
            });

            it('should create a new exclusion and then exclude the study', () => {
                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');
                cy.wait('@taskExtraction');
                cy.wait('@participantDemographicsExtraction');

                cy.contains('li', '1. Unreviewed').click();
                cy.get('tr').eq(1).click({ force: true });
                cy.contains('button', /^Exclude$/)
                    .next()
                    .click();
                cy.contains('label', 'reason to exclude').click({ force: true });
                cy.contains('label', 'reason to exclude').type('some new exclusion reason');
                cy.contains('li', 'Add "some new exclusion reason"').click();

                cy.contains('li', '1. Unreviewed').find('.MuiChip-label').should('have.text', 3);
                cy.contains('li', 'Excluded').click();
                cy.contains('li', 'some new exclusion reason').should('exist');
            });

            it('should move the study to the previous phase', () => {
                cy.fixture('projects/projectCurationPRISMAWithStudies').then(
                    (projectFixture: INeurosynthProjectReturn) => {
                        projectFixture.provenance.curationMetadata.columns[1].stubStudies =
                            projectFixture.provenance.curationMetadata.columns[0].stubStudies;
                        projectFixture.provenance.curationMetadata.columns[0].stubStudies = [];

                        cy.intercept('GET', '**/api/projects/*', {
                            ...projectFixture,
                        } as INeurosynthProjectReturn).as('projectFixture');
                    }
                );

                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');
                cy.wait('@taskExtraction');
                cy.wait('@participantDemographicsExtraction');

                cy.contains('li', '1. Identification').find('.MuiChip-label').should('have.text', 0);
                cy.contains('li', '2. Screening').find('.MuiChip-label').should('have.text', 80);
                cy.contains('li', '2. Screening').click();
                cy.get('tr').eq(1).click({ force: true });
                cy.contains('button', /^Demote$/).click();

                cy.contains('li', '1. Identification').find('.MuiChip-label').should('have.text', 1);
                cy.contains('li', '2. Screening').find('.MuiChip-label').should('have.text', 79);
            });
        });

        it('should uninclude the study', () => {
            cy.fixture('projects/projectCurationPRISMAWithStudies').then((projectFixture: INeurosynthProjectReturn) => {
                projectFixture.provenance.curationMetadata.columns[3].stubStudies =
                    projectFixture.provenance.curationMetadata.columns[0].stubStudies;
                projectFixture.provenance.curationMetadata.columns[0].stubStudies = [];

                cy.intercept('GET', '**/api/projects/*', {
                    ...projectFixture,
                } as INeurosynthProjectReturn).as('projectFixture');
            });

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');
            cy.wait('@taskExtraction');
            cy.wait('@participantDemographicsExtraction');

            cy.contains('li', '3. Eligibility').find('.MuiChip-label').should('have.text', 0);
            cy.contains('li', '4. Included').find('.MuiChip-label').should('have.text', 80);
            cy.contains('li', '4. Included').click();
            cy.get('tr').eq(1).click({ force: true });
            cy.contains(/^Included$/)
                .parent()
                .find('[data-testid="CancelIcon"]')
                .click();
            cy.contains('li', '3. Eligibility').find('.MuiChip-label').should('have.text', 1);
            cy.contains('li', '4. Included').find('.MuiChip-label').should('have.text', 79);
        });
    });

    describe('imports', () => {
        it('should have imports', () => {
            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');
            cy.contains('li', 'brain trauma').should('exist');
            cy.contains('li', 'brain trauma').find('.MuiChip-label').should('have.text', 4);
        });

        it('should show the studies in the import view', () => {
            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');
            cy.contains('li', 'brain trauma').click();
            cy.fixture('projects/projectCurationSimpleWithStudies').then((projectFixture: INeurosynthProjectReturn) => {
                const importId = projectFixture.provenance.curationMetadata.imports[0].id;
                const allStudies = projectFixture.provenance.curationMetadata.columns.reduce(
                    (acc, curr) => acc.concat(curr.stubStudies),
                    [] as ICurationStubStudy[]
                );

                allStudies
                    .filter((s) => s.importId === importId)
                    .forEach((study) => {
                        cy.contains(study.title).should('exist');
                    });
            });
        });

        it('should filter the studies in the import view', () => {
            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');
            cy.contains('li', 'brain trauma').click();
            cy.get('input[type="text"]').type('Meta-Analysis');
            cy.get('.virtualized-import-list-item').should('have.length', 1);
        });
    });

    describe('exclusions', () => {
        it('should show empty when in the exclusions view and there are no studies', () => {
            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');
            cy.contains('li', 'Excluded').click();
            cy.contains('Duplicate').click();
            cy.contains('No studies for this exclusion').should('exist');
        });

        it('should show excluded studies in the exclusions view', () => {
            cy.fixture('projects/projectCurationSimpleWithStudies').then((projectFixture: INeurosynthProjectReturn) => {
                projectFixture.provenance.curationMetadata.columns[0].stubStudies[0].exclusionTag = {
                    id: defaultExclusionTags.duplicate.id,
                    label: defaultExclusionTags.duplicate.label,
                    isAssignable: false,
                    isExclusionTag: true,
                };

                projectFixture.provenance.curationMetadata.columns[0].stubStudies[1].exclusionTag = {
                    id: defaultExclusionTags.duplicate.id,
                    label: defaultExclusionTags.duplicate.label,
                    isAssignable: false,
                    isExclusionTag: true,
                };

                cy.intercept('GET', '**/api/projects/*', {
                    ...projectFixture,
                } as INeurosynthProjectReturn).as('projectFixture');
            });

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@projectFixture');

            cy.contains('li', 'Excluded').click();
            cy.contains('Duplicate').click(); // open Duplicate exclusion group
            cy.get('.MuiListItem-root .MuiTypography-root').get('li:contains(Duplicate)').should('have.length', 3); // includes the Duplicate exclusion group list item
        });

        it('should unexclude the study', () => {
            cy.fixture('projects/projectCurationSimpleWithStudies').then((projectFixture: INeurosynthProjectReturn) => {
                projectFixture.provenance.curationMetadata.columns[0].stubStudies[0].exclusionTag = {
                    id: defaultExclusionTags.duplicate.id,
                    label: defaultExclusionTags.duplicate.label,
                    isAssignable: false,
                    isExclusionTag: true,
                };

                projectFixture.provenance.curationMetadata.columns[0].stubStudies[1].exclusionTag = {
                    id: defaultExclusionTags.duplicate.id,
                    label: defaultExclusionTags.duplicate.label,
                    isAssignable: false,
                    isExclusionTag: true,
                };

                cy.intercept('GET', '**/api/projects/*', {
                    ...projectFixture,
                } as INeurosynthProjectReturn).as('projectFixture');

                cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
                cy.wait('@projectFixture');

                cy.contains('li', 'Excluded').click();
                cy.contains('Duplicate').click(); // open Duplicate exclusion group

                cy.get('.MuiListItem-root .MuiTypography-root').get('li:contains(Duplicate)').should('have.length', 3); // includes the Duplicate exclusion group list item
                cy.get('[data-testid="CancelIcon"]').click();
                cy.get('.MuiListItem-root .MuiTypography-root').get('li:contains(Duplicate)').should('have.length', 2); // includes the Duplicate exclusion group list item
            });
        });
    });
});
