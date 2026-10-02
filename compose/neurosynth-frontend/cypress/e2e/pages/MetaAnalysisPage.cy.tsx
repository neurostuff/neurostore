/// <reference types="cypress" />

import { MetaAnalysisJobList, MetaAnalysisJobResponse, ResultReturn } from 'neurosynth-compose-typescript-sdk';

const PAGE_NAME = 'MetaAnalysisPage';
const PROJECT_PATH = '/projects/mock-project-id/meta-analyses/mock-meta-analysis-id';

const expectMetaAnalysisTabs = (labels: string[]) => {
    cy.get('[role="tab"]').should(($tabs) => {
        const actual = [...$tabs].map((tab) => tab.textContent?.trim());
        expect(actual).to.deep.equal(labels);
    });
};

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', '**/api/**', (req) => {
            if (req.url.includes('/api/meta-analyses')) {
                // eslint-disable-next-line no-console
                console.log('DEBUG_META_ANALYSIS_REQUEST', req.method, req.url);
            }
            req.continue();
        }).as('debugApiRequests');

        cy.intercept('GET', `**/api/annotations/*`, { fixture: 'annotation' }).as('annotationFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/projects/*`, { fixture: 'projects/project' }).as('projectFixture');

        cy.intercept('GET', 'https://neurovault.org/api/images/1013647', {
            fixture: 'MetaAnalysis/neurovaultImage1013647',
        }).as('neurovaultImageFixture');
        cy.intercept('GET', 'https://neurovault.org/api/images/1013650', {
            fixture: 'MetaAnalysis/neurovaultImage1013650',
        }).as('neurovaultImageFixture');
    });

    describe('Basic page load', () => {
        it('should load successfully with project context', () => {
            cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
                'specificationFixture'
            );
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisNoResults',
            }).as('metaAnalysisFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs*`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            // Should show breadcrumbs when in project context
            cy.contains('Projects').should('exist');
            cy.contains('Bulk import test').should('exist');
            cy.contains('THIS IS MY TEST META ANALYSIS').should('exist');
            cy.contains('ALE meta analysis').should('exist');
            cy.contains('Owner: mock-username').should('exist');
            cy.contains('Public').should('exist');
            cy.contains('.MuiChip-root', /^Created:/).should('exist');
            cy.contains('.MuiChip-root', /^Last updated:/).should('not.exist');
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
            cy.intercept('GET', `**/api/meta-analysis-jobs*`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });
        });

        it('should show run instructions in the first tab', () => {
            // The first tab should show instructions to run the meta-analysis
            cy.contains('Run Meta-Analysis').should('exist');
            cy.contains('Run Meta-Analysis').click();
            // Check that instructions are visible (adjust based on actual instruction text)
            cy.contains('Meta-Analysis').should('exist');
        });

        it('should show a "No run detected" status chip', () => {
            cy.wait('@jobsFixture');
            cy.contains('.MuiChip-root', 'No run detected').should('be.visible');
            cy.contains('.MuiChip-root', 'No run detected').trigger('mouseover');
            cy.contains(
                'If you are running a meta-analysis via google colab, you will not be able to see the progress here until it has completed'
            ).should('exist');
            cy.get('[role="alert"]').should('not.exist');
        });

        it('should show correct tab labels when no results or jobs exist', () => {
            expectMetaAnalysisTabs(['Run Meta-Analysis', 'Edit Specification', 'Cite Me', 'Settings']);
        });

        it('should allow specification editing when no results or jobs exist', () => {
            cy.contains('[role="tab"]', 'Edit Specification').click();
            cy.contains('button', 'Edit Specification').should('exist').and('not.be.disabled');
        });

        it('should show Settings tab when no results or jobs exist', () => {
            cy.contains('Settings').should('exist');
            cy.contains('[role="tab"]', 'Settings').click();
            cy.contains('Access').should('exist');
            cy.contains('label', 'Name').should('exist');
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
            cy.intercept('GET', `**/api/meta-analysis-jobs*`, {
                fixture: 'MetaAnalysis/jobs/jobsListRunning',
            }).as('jobsFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs/*`, {
                fixture: 'MetaAnalysis/jobs/jobRunning',
            }).as('jobDetailFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });
        });

        it('should show job logs', () => {
            cy.contains('Run Meta-Analysis').should('exist');
            cy.contains('Click to view logs').should('exist').click();
            cy.contains('INFO:compose_runner.ecs_task').should('exist');
            cy.contains('Running...').should('exist');
        });

        it('should show a "Run in progress" status chip for a running job', () => {
            cy.contains('.MuiChip-root', 'Run in progress').should('exist');
            cy.get('.MuiChip-root').find('[role="progressbar"]').should('exist');
        });

        it('should show correct tab labels when job is running', () => {
            expectMetaAnalysisTabs([
                'Run Meta-Analysis',
                'View Specification',
                'Cite Me',
                'Run Again',
                'Settings',
            ]);
        });

        it('should NOT allow specification editing when job is running', () => {
            cy.contains('[role="tab"]', 'View Specification').click();
            cy.contains('button', 'Edit Specification').should('not.exist');
        });

        it('should show Settings and Run Again when a job is running', () => {
            cy.contains('[role="tab"]', 'Settings').should('exist');
            cy.contains('[role="tab"]', 'Run Again').click();
            cy.contains('Run your meta-analysis via one of the following methods').should('exist');
            cy.contains('[role="tab"]', 'Settings').click();
            cy.contains('Access').should('exist');
            cy.contains('Danger zone').should('not.exist');
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
            cy.intercept('GET', `**/api/meta-analysis-jobs*`, {
                fixture: 'MetaAnalysis/jobs/jobsListSubmitted',
            }).as('jobsFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs/*`, {
                fixture: 'MetaAnalysis/jobs/jobSubmitted',
            }).as('jobDetailFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });
        });

        it('should show a "Job submitted" status chip', () => {
            cy.contains('.MuiChip-root', 'Job submitted').should('exist');
        });

        it('should show job logs', () => {
            cy.contains('Click to view logs').should('exist').click();
            cy.contains('Job submitted to queue...').should('exist');
        });
    });

    describe('Job exists - SUCCEEDED', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/analyses/*`, {
                fixture: 'MetaAnalysis/analysis',
            }).as('analysisFixture');
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisWithResult',
            }).as('metaAnalysisFixture');
            cy.intercept('GET', `**/api/meta-analysis-results/*`, {
                fixture: 'MetaAnalysis/resultSuccess',
            }).as('resultFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs*`, {
                fixture: 'MetaAnalysis/jobs/jobsListSucceeded',
            }).as('jobsFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs/*`, {
                fixture: 'MetaAnalysis/jobs/jobSucceeded',
            }).as('jobDetailFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });
        });

        it('should show a "Run successful" status chip', () => {
            cy.contains('.MuiChip-root', 'Run successful').should('exist');
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
            cy.intercept('GET', `**/api/meta-analysis-jobs*`, {
                fixture: 'MetaAnalysis/jobs/jobsListFailed',
            }).as('jobsFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs/*`, {
                fixture: 'MetaAnalysis/jobs/jobFailed',
            }).as('jobDetailFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });
        });

        it('should show a "Run failed" status chip', () => {
            cy.contains('.MuiChip-root', 'Run failed').should('exist');
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
            cy.intercept('GET', `**/api/meta-analysis-jobs*`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');
            cy.intercept('GET', `**/api/meta-analysis-results/*`, {
                fixture: 'MetaAnalysis/resultSuccess',
            }).as('resultFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });
        });

        it('should show result display', () => {
            cy.contains('Meta Analysis Results').should('exist');
            cy.contains('Open in neurovault').should('exist');
        });

        it('should show a "Run successful" status chip for a successful result', () => {
            cy.contains('.MuiChip-root', 'Run successful').should('exist');
        });

        it('should show correct tab labels when result exists', () => {
            expectMetaAnalysisTabs([
                'Meta Analysis Results',
                'View Specification',
                'Cite Me',
                'Run Again',
                'Settings',
            ]);
        });

        it('should NOT allow specification editing when result exists', () => {
            cy.contains('[role="tab"]', 'View Specification').click();
            cy.contains('button', 'Edit Specification').should('not.exist');
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

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

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

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            // Should show results instead of job
            cy.contains('Run successful').should('exist');
            cy.contains('Open in neurovault').should('exist');
        });
    });

    describe('Status chip', () => {
        it('should update the status chip after running a meta-analysis', () => {
            cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
                'specificationFixture'
            );
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisNoResults',
            }).as('metaAnalysisFixture');

            let jobsRequestCount = 0;
            cy.intercept('GET', `**/api/meta-analysis-jobs*`, (req) => {
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

            cy.intercept('POST', `**/api/meta-analysis-jobs*`, {
                fixture: 'MetaAnalysis/jobs/jobSubmitted',
            }).as('jobRunningFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            cy.contains('.MuiChip-root', 'No run detected').should('exist');
            cy.contains('run meta-analysis').click();
            cy.contains('Run meta-analysis').click();
            cy.contains('.MuiChip-root', 'Job submitted').should('exist');
        });
    });

    describe('Edit meta-analysis', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
                'specificationFixture'
            );
            cy.intercept('GET', `**/api/meta-analysis-jobs*`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');
            cy.intercept('PUT', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisNoResults',
            }).as('updateMetaAnalysisFixture');
        });

        it('should set the meta-analysis from public to private when logged in and you own it', () => {
            cy.fixture('MetaAnalysis/metaAnalysisNoResults').then((metaAnalysis) => {
                metaAnalysis.public = true;
                cy.intercept('GET', `**/api/meta-analyses/**`, metaAnalysis).as('metaAnalysisFixture');
            });

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            cy.contains('[role="tab"]', 'Settings').click();
            cy.contains('button', 'Private').click();
            cy.contains('button', 'Save').click();
            cy.wait('@updateMetaAnalysisFixture').then((res) => {
                assert.exists(res.request.body.public);
                assert.isFalse(res.request.body.public);
            });
        });

        it('should set the meta-analysis from private to public when logged in and you own it', () => {
            cy.fixture('MetaAnalysis/metaAnalysisNoResults').then((metaAnalysis) => {
                metaAnalysis.public = false;
                cy.intercept('GET', `**/api/meta-analyses/**`, metaAnalysis).as('metaAnalysisFixture');
            });

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            cy.contains('Private').should('exist');
            cy.contains('[role="tab"]', 'Settings').click();
            cy.contains('button', 'Public').click();
            cy.contains('button', 'Save').click();
            cy.wait('@updateMetaAnalysisFixture').then((res) => {
                assert.exists(res.request.body.public);
                assert.isTrue(res.request.body.public);
            });
        });

        it('should not show the privacy toggle when the user does not own the meta-analysis', () => {
            cy.fixture('projects/project').then((project) => {
                project.public = true;
                project.user = 'other-user';
                cy.intercept('GET', `**/api/projects/*`, project).as('projectFixture');
            });
            cy.fixture('MetaAnalysis/metaAnalysisNoResults').then((metaAnalysis) => {
                metaAnalysis.public = true;
                metaAnalysis.user = 'other-user';
                cy.intercept('GET', `**/api/meta-analyses/**`, metaAnalysis).as('metaAnalysisFixture');
            });

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            cy.contains('Public').should('exist');
            cy.contains('[role="tab"]', 'Settings').should('not.exist');
            cy.contains('button', 'Private').should('not.exist');
        });

        it('should not allow a non-owner to view a private meta-analysis', () => {
            cy.fixture('projects/project').then((project) => {
                project.public = true;
                project.user = 'other-user';
                cy.intercept('GET', `**/api/projects/*`, project).as('projectFixture');
            });
            cy.fixture('MetaAnalysis/metaAnalysisNoResults').then((metaAnalysis) => {
                metaAnalysis.public = false;
                metaAnalysis.user = 'other-user';
                cy.intercept('GET', `**/api/meta-analyses/**`, metaAnalysis).as('metaAnalysisFixture');
            });

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            cy.contains('Forbidden').should('exist');
            cy.contains('You do not have access to this meta-analysis').should('exist');
        });
    });

    describe('Breadcrumbs', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
                'specificationFixture'
            );
            cy.intercept('GET', `**/api/meta-analysis-jobs*`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');
        });

        it('should show project breadcrumbs when opened from a project', () => {
            cy.fixture('MetaAnalysis/metaAnalysisNoResults').then((metaAnalysis) => {
                metaAnalysis.public = true;
                cy.intercept('GET', `**/api/meta-analyses/**`, metaAnalysis).as('metaAnalysisFixture');
            });

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            cy.get('.MuiBreadcrumbs-root').contains('Projects');
            cy.get('.MuiBreadcrumbs-root').contains('Bulk import test');
            cy.get('.MuiBreadcrumbs-root').contains('THIS IS MY TEST META ANALYSIS');
        });

        it('should show catalog breadcrumbs and a view project button when the project is public', () => {
            cy.fixture('projects/project').then((project) => {
                project.public = true;
                project.user = 'other-user';
                cy.intercept('GET', `**/api/projects/*`, project).as('projectFixture');
            });
            cy.fixture('MetaAnalysis/metaAnalysisNoResults').then((metaAnalysis) => {
                metaAnalysis.public = true;
                metaAnalysis.user = 'other-user';
                cy.intercept('GET', `**/api/meta-analyses/**`, metaAnalysis).as('metaAnalysisFixture');
            });

            cy.login('mocked')
                .visit('/meta-analyses/mock-meta-analysis-id')
                .wait('@metaAnalysisFixture', { timeout: 20000 });
            cy.wait('@projectFixture');

            cy.get('.MuiBreadcrumbs-root').contains('Meta-Analyses');
            cy.get('.MuiBreadcrumbs-root').should('not.contain', 'Projects');
            cy.get('.MuiBreadcrumbs-root').should('not.contain', 'Bulk import test');
            cy.contains('View project').should('exist');
        });

        it('should show catalog breadcrumbs without a view project button when the project is private', () => {
            cy.fixture('projects/project').then((project) => {
                project.user = 'other-user';
                cy.intercept('GET', `**/api/projects/*`, project).as('projectFixture');
            });
            cy.fixture('MetaAnalysis/metaAnalysisNoResults').then((metaAnalysis) => {
                metaAnalysis.public = true;
                metaAnalysis.user = 'other-user';
                cy.intercept('GET', `**/api/meta-analyses/**`, metaAnalysis).as('metaAnalysisFixture');
            });

            cy.login('mocked')
                .visit('/meta-analyses/mock-meta-analysis-id')
                .wait('@metaAnalysisFixture', { timeout: 20000 });
            cy.wait('@projectFixture');

            cy.get('.MuiBreadcrumbs-root').contains('Meta-Analyses');
            cy.get('.MuiBreadcrumbs-root').should('not.contain', 'Bulk import test');
            cy.contains('View project').should('not.exist');
            cy.contains('THIS IS MY TEST META ANALYSIS').should('exist');
        });
    });

    describe('Logged out viewer', () => {
        it('should show results, specification, and cite me tabs', () => {
            cy.fixture('MetaAnalysis/metaAnalysisNoResults').then((metaAnalysis) => {
                metaAnalysis.public = true;
                cy.intercept('GET', `**/api/meta-analyses/**`, metaAnalysis).as('metaAnalysisFixture');
            });
            cy.intercept('GET', `**/api/specifications/**`, { fixture: 'MetaAnalysis/specification' }).as(
                'specificationFixture'
            );

            cy.visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            expectMetaAnalysisTabs(['Meta Analysis Results', 'View Specification', 'Cite Me']);
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
            cy.intercept('GET', `**/api/meta-analysis-jobs*`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            cy.contains('[role="tab"]', 'Edit Specification').click();
            cy.contains('button', 'Edit Specification').should('exist').and('not.be.disabled');
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
            cy.intercept('GET', `**/api/meta-analysis-jobs*`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });
            cy.contains('[role="tab"]', 'View Specification').click();
            cy.contains('button', 'Edit Specification').should('be.disabled');
        });
    });

    describe('Cite Me', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/meta-analyses/**`, {
                fixture: 'MetaAnalysis/metaAnalysisWithResult',
            }).as('metaAnalysisFixture');
            cy.intercept('GET', `**/api/meta-analysis-jobs*`, {
                fixture: 'MetaAnalysis/jobs/noJobs',
            }).as('jobsFixture');
            cy.intercept('GET', `**/api/meta-analysis-results/*`, {
                fixture: 'MetaAnalysis/resultSuccess',
            }).as('resultFixture');
            cy.intercept('GET', 'https://doi.org/*', (req) => {
                if (req.url.includes('10.1162/IMAG.a.1114')) {
                    req.reply({ fixture: 'citation/neurosynthComposeCsl.json' });
                } else if (req.url.includes('10.52294/001c.87681')) {
                    req.reply({ fixture: 'citation/nimareCsl.json' });
                } else {
                    req.reply({ statusCode: 404 });
                }
            }).as('doiRequest');
        });

        it('should show the cite me component when tab is clicked', () => {
            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            cy.contains('[role="tab"]', 'Cite Me').click();
            cy.contains('Copy citations in your preferred format:', { timeout: 20000 }).should('exist');
        });

        it('should show citation format dropdown and citation content after loading', () => {
            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            cy.contains('Cite Me').click();
            cy.get('[role="combobox"]', { timeout: 15000 }).should('exist');
            cy.contains('Neurosynth Compose').should('exist');
        });

        it('should allow selecting different citation formats from dropdown', () => {
            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            cy.contains('Cite Me').click();
            cy.get('[role="combobox"]', { timeout: 15000 }).should('exist').click();
            cy.get('[role="option"]').contains('BibTeX').click();
            cy.contains('@').should('exist');

            cy.get('[role="combobox"]').click();
            cy.get('[role="option"]').contains('Vancouver').click();
            cy.contains('NiMARE').should('exist');
        });

        it('should show the compose-runner version and the methods with readable citations', () => {
            cy.fixture('MetaAnalysis/resultSuccess').then((result) => {
                result.cli_version = '0.6.6';
                result.method_description =
                    'An ALE meta-analysis was performed with NiMARE (RRID:SCR_017398; \\citealt{Salo2023}).';
                result.method_references =
                    '@article{Salo2023,\n  title = {NiMARE: Neuroimaging Meta-Analysis Research Environment},\n  author = {Salo, Taylor and Laird, Angela R},\n  journal = {Aperture Neuro},\n  year = {2023}\n}';
                cy.intercept('GET', `**/api/meta-analysis-results/*`, result).as('resultFixture');
            });

            cy.login('mocked').visit(PROJECT_PATH).wait('@metaAnalysisFixture', { timeout: 20000 });

            cy.contains('[role="tab"]', 'Cite Me').click();
            cy.contains('Run with compose-runner 0.6.6').should('exist');
            cy.contains('An ALE meta-analysis was performed with NiMARE (RRID:SCR_017398; Salo & Laird, 2023).', {
                timeout: 15000,
            }).should('exist');
            cy.contains(
                'Salo, T., & Laird, A. R. (2023). NiMARE: Neuroimaging Meta-Analysis Research Environment.'
            ).should('exist');
        });
    });
});
