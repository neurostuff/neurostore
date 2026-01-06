/// <reference types="cypress" />

import { MetaAnalysisJobList, MetaAnalysisJobResponse, ResultReturn } from 'neurosynth-compose-typescript-sdk';

const PAGE_NAME = 'MetaAnalysisPage';
const PROJECT_PATH = '/projects/mock-project-id/meta-analyses/mock-meta-analysis-id';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', `**/api/annotations/*`, { fixture: 'annotation' }).as('annotationFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/projects/*`, { fixture: 'projects/project' }).as('projectFixture');
    });

    describe('Basic page load', () => {
        it('should load successfully with project context', () => {
            cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
                'specificationFixture'
            );
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisNoResults',
            }).as('metaAnalysisFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture');

            // Should show breadcrumbs when in project context
            cy.contains('Projects').should('exist');
            cy.contains('Bulk import test').should('exist');
            cy.contains('THIS IS MY TEST META ANALYSIS').should('exist');
            cy.contains('Run your meta-analysis via one of the following methods').should('exist');
        });
    });

    describe('No result and no job', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
                'specificationFixture'
            );
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisNoResults',
            }).as('metaAnalysisFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture');
        });

        it('should show run instructions in the first tab', () => {
            // The first tab should show instructions to run the meta-analysis
            cy.contains('Run Meta-Analysis').should('exist');
            cy.contains('Run Meta-Analysis').click();
            // Check that instructions are visible (adjust based on actual instruction text)
            cy.contains('Meta-Analysis').should('exist');
        });

        it('should show "No run detected" alert message', () => {
            cy.contains('No run detected').should('exist');
            cy.contains(
                'If you are running a meta-analysis via google colab, you will not be able to see the progress here until it has completed'
            ).should('exist');
        });

        it('should show correct tab labels when no results or jobs exist', () => {
            cy.contains('Run Meta-Analysis').should('exist');
            cy.contains('Edit Specification').should('exist');
            cy.contains('Settings').should('exist');
        });

        it('should allow specification editing when no results or jobs exist', () => {
            cy.contains('Edit Specification').click();
            cy.get('button').contains('Edit Specification').should('exist');
            cy.get('button').contains('Edit Specification').should('not.be.disabled');
        });

        it('should show Settings tab when no results or jobs exist', () => {
            cy.contains('Settings').should('exist');
            cy.contains('Settings').click();
            cy.contains('Danger zone').should('exist');
            cy.contains('delete this meta-analysis').should('exist').and('be.visible').and('not.be.disabled');
        });
    });

    describe('Job exists - RUNNING', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
                'specificationFixture'
            );
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisNoResults',
            }).as('metaAnalysisFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs`, {
                fixture: 'MetaAnalysis/jobs/jobsListRunning',
            }).as('jobsFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs/*`, {
                fixture: 'MetaAnalysis/jobs/jobRunning',
            }).as('jobDetailFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture');
        });

        it('should show job logs', () => {
            cy.contains('Run Meta-Analysis').should('exist');
            cy.contains('Click to view logs').should('exist').click();
            cy.contains('INFO:compose_runner.ecs_task').should('exist');
            cy.contains('Running...').should('exist');
        });

        it('should show "Run in progress" alert message for running job', () => {
            cy.contains('Run in progress').should('exist');
            cy.get('[role="progressbar"]').should('exist');
        });

        it('should show correct tab labels when job is running', () => {
            cy.contains('Run Meta-Analysis').should('exist');
            cy.contains('View Specification').should('exist');
            cy.contains('Run Again').should('exist');
        });

        it('should NOT allow specification editing when job is running', () => {
            cy.contains('View Specification').click();
            cy.get('button').contains('Edit Specification').should('not.exist');
        });

        it('should show "Run Again" instead of "Settings" when job is running', () => {
            cy.contains('Settings').should('not.exist');
            cy.contains('Run Again').should('exist');
            cy.contains('Run Again').click();
            cy.contains('Run your meta-analysis via one of the following methods').should('exist');
        });
    });

    describe('Job exists - SUBMITTED', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
                'specificationFixture'
            );
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisNoResults',
            }).as('metaAnalysisFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs`, {
                fixture: 'MetaAnalysis/jobs/jobsListSubmitted',
            }).as('jobsFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs/*`, {
                fixture: 'MetaAnalysis/jobs/jobSubmitted',
            }).as('jobDetailFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture');
        });

        it('should show "Job submitted" alert message', () => {
            cy.contains('Job submitted').should('exist');
        });

        it('should show job logs', () => {
            cy.contains('Click to view logs').should('exist').click();
            cy.contains('Job submitted to queue...').should('exist');
        });
    });

    describe('Job exists - SUCCEEDED', () => {
        beforeEach(() => {
            // cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
            //     'specificationFixture'
            // );
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisWithResult',
            }).as('metaAnalysisFixture');
            cy.intercept('GET', `**/api/meta-analysis-results/*`, {
                fixture: 'MetaAnalysis/resultSuccess',
            }).as('resultFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs`, {
                fixture: 'MetaAnalysis/jobs/jobsListSucceeded',
            }).as('jobsFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs/*`, {
                fixture: 'MetaAnalysis/jobs/jobSucceeded',
            }).as('jobDetailFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture');
        });

        it('should show "Run successful" alert message', () => {
            cy.contains('Run successful').should('exist');
        });

        it('should show result display', () => {
            cy.contains('Meta Analysis Results').should('exist');
            cy.contains('Open in neurovault').should('exist');
        });
    });

    describe('Job exists - FAILED', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisNoResults',
            }).as('metaAnalysisFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs`, {
                fixture: 'MetaAnalysis/jobs/jobsListFailed',
            }).as('jobsFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs/*`, {
                fixture: 'MetaAnalysis/jobs/jobFailed',
            }).as('jobDetailFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture');
        });

        it('should show "Run failed" alert message', () => {
            cy.contains('Run failed').should('exist');
        });

        it('should show job logs with error information', () => {
            cy.contains('Click to view logs').should('exist').click();
        });
    });

    describe('Result exists (no job)', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
                'specificationFixture'
            );
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisWithResult',
            }).as('metaAnalysisFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');
            cy.intercept('GET', `**/api/meta-analysis-results/*`, {
                fixture: 'MetaAnalysis/resultSuccess',
            }).as('resultFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture');
        });

        it('should show result display', () => {
            cy.contains('Meta Analysis Results').should('exist');
            cy.contains('Open in neurovault').should('exist');
        });

        it('should show "Run successful" alert for successful result', () => {
            cy.contains('Run successful').should('exist');
        });

        it('should show correct tab labels when result exists', () => {
            cy.contains('Meta Analysis Results').should('exist');
            cy.contains('View Specification').should('exist');
            cy.contains('Run Again').should('exist');
        });

        it('should NOT allow specification editing when result exists', () => {
            cy.contains('View Specification').click();
            cy.get('button').contains('Edit Specification').should('not.exist');
        });
    });

    describe('Both result and job exist', () => {
        it('should show the job when the job has been created more recently than the result', () => {
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisWithResult',
            }).as('metaAnalysisFixture');

            const newerTimestamp = new Date('2025-12-08T22:04:34.379147+00:00').toISOString();
            const olderTimestamp = new Date('2025-10-08T22:04:34.379147+00:00').toISOString();

            cy.fixture('MetaAnalysis/jobs/jobsListRunning').then((jobs: MetaAnalysisJobList) => {
                const jobResults = jobs.results as Array<MetaAnalysisJobResponse>;
                jobResults[jobResults.length - 1].created_at = newerTimestamp;
                cy.intercept('GET', '**/api/meta-analysis-jobs', {
                    ...jobs,
                }).as('jobsFixture');
            });

            cy.fixture('MetaAnalysis/jobs/jobRunning').then((job: MetaAnalysisJobResponse) => {
                job.created_at = newerTimestamp;
                cy.intercept('GET', `**/api/meta-analysis-jobs/*`, {
                    ...job,
                }).as('jobDetailFixture');
            });

            cy.fixture('MetaAnalysis/resultSuccess').then((result: ResultReturn) => {
                result.created_at = olderTimestamp;
                cy.intercept('GET', `**/api/meta-analysis-results/*`, {
                    ...result,
                }).as('resultFixture');
            });

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture');

            // Should show job logs instead of results
            cy.contains('Click to view logs').should('exist').click();
            cy.contains('Run in progress').should('exist');
        });

        it('should show result when result is more recent than job', () => {
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisWithResult',
            }).as('metaAnalysisFixture');

            const newerTimestamp = new Date('2025-12-08T22:04:34.379147+00:00').toISOString();
            const olderTimestamp = new Date('2025-10-08T22:04:34.379147+00:00').toISOString();

            cy.fixture('MetaAnalysis/jobs/jobsListRunning').then((jobs: MetaAnalysisJobList) => {
                const jobResults = jobs.results as Array<MetaAnalysisJobResponse>;
                jobResults[jobResults.length - 1].created_at = olderTimestamp;
                cy.intercept('GET', '**/api/meta-analysis-jobs', {
                    ...jobs,
                }).as('jobsFixture');
            });

            cy.fixture('MetaAnalysis/jobs/jobRunning').then((job: MetaAnalysisJobResponse) => {
                job.created_at = olderTimestamp;
                cy.intercept('GET', `**/api/meta-analysis-jobs/*`, {
                    ...job,
                }).as('jobDetailFixture');
            });

            cy.fixture('MetaAnalysis/resultSuccess').then((result: ResultReturn) => {
                result.created_at = newerTimestamp;
                cy.intercept('GET', `**/api/meta-analysis-results/*`, {
                    ...result,
                }).as('resultFixture');
            });

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture');

            // Should show results instead of job
            cy.contains('Run successful').should('exist');
            cy.contains('Open in neurovault').should('exist');
        });
    });

    describe('Alert message dismissal', () => {
        it('should allow dismissing the alert message', () => {
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisWithResult',
            }).as('metaAnalysisFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');
            cy.intercept('GET', `**/api/meta-analysis-results/*`, {
                fixture: 'MetaAnalysis/resultSuccess',
            }).as('resultFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture');

            cy.contains('Run successful').should('exist');
            cy.get('[role="alert"]').within(() => {
                cy.get('button').click();
            });

            cy.contains('Run successful').should('not.exist');
        });

        it('should redisplay the alert after running a meta-analysis if it was previously dismissed', () => {
            cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
                'specificationFixture'
            );
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisNoResults',
            }).as('metaAnalysisFixture');

            let jobsRequestCount = 0;
            cy.intercept('GET', `**/api/meta-analysis-jobs`, (req) => {
                if (jobsRequestCount === 0) {
                    jobsRequestCount++;
                    req.reply({ fixture: 'MetaAnalysis/jobs/noJobs' });
                } else {
                    req.reply({ fixture: 'MetaAnalysis/jobs/jobsListSubmitted' });
                }
            }).as('jobsFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs/*`, {
                fixture: 'MetaAnalysis/jobs/jobSubmitted',
            }).as('jobDetailFixture');

            cy.intercept('POST', `**/api/meta-analysis-jobs`, {
                fixture: 'MetaAnalysis/jobs/jobSubmitted',
            }).as('jobRunningFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture');

            // Alert is visible at first
            cy.contains('No run detected').should('exist');

            // Dismiss the alert
            cy.get('[role="alert"]').within(() => {
                cy.get('button').click();
            });
            cy.contains('No run detected').should('not.exist');

            // The alert should appear again
            cy.contains('run meta-analysis').click();
            cy.contains('Run meta-analysis').click();
            cy.contains('Job submitted').should('exist');
        });
    });

    describe('User permissions', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
                'specificationFixture'
            );
        });

        it('should show edit button when user has edit permissions', () => {
            cy.fixture('projects/project').then((project) => {
                project.public = false;
                project.user = 'auth0|62e0e6c9dd47048572613b4d';
                cy.intercept('GET', `**/api/projects/*`, project).as('projectFixture');
            });
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisNoResults',
            }).as('metaAnalysisFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture');

            cy.contains('Edit Specification').click();
            cy.get('button').contains('Edit Specification').should('exist');
            cy.get('button').contains('Edit Specification').should('not.be.disabled');
        });

        it('should not show edit button when user does not have edit permissions', () => {
            cy.fixture('projects/project').then((project) => {
                project.public = true;
                project.user = 'other-user';
                cy.intercept('GET', `**/api/projects/*`, project).as('projectFixture');
            });
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisNoResults',
            }).as('metaAnalysisFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture');
            cy.contains('View Specification').click();
            cy.get('button').contains('Edit Specification').should('be.disabled');
        });
    });
});
