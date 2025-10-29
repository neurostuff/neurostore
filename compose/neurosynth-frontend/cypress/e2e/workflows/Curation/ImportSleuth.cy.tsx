/// <reference types="cypress" />
import { BaseStudy, BaseStudyReturn, StudyReturn } from 'neurostore-typescript-sdk';
import baseStudiesSingleSleuthStudyResponse from '../../../fixtures/ImportSleuth/neurosynthResponses/baseStudiesSingleSleuthStudyResponse.json';

describe('ImportSleuthDialog', () => {
    const neurostoreAPIBaseURL = Cypress.env('neurostoreAPIBaseURL');

    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('POST', `https://www.google-analytics.com/*/**`, {}).as('googleAnalyticsFixture');
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'projects/projectExtractionStep',
        }).as('projectFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
        cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');

        cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');
        cy.contains('button', 'import studies').click();
        cy.contains('Sleuth').click();
        cy.contains('button', 'next').click();
    });

    describe('upload page', () => {
        it('should show the sleuth upload page', () => {
            cy.contains(/Please ensure that your sleuth files are in the correct format before uploading/i).should(
                'be.visible'
            );
        });

        it('should disable upload by default', () => {
            cy.contains('button', 'next').should('be.disabled');
        });
    });

    describe('should handle invalid sleuth files', () => {
        it('should upload a file and show invalid if not plain/text', () => {
            cy.get('input[type="file"]').selectFile('cypress/fixtures/ImportSleuth/random.csv', { force: true });
            cy.contains('File should be .txt');
        });

        it('should upload a file and show invalid with no reference', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/invalidSleuthFileNoReference.txt',
                { force: true }
            );
            cy.contains('No coordinate reference');
        });

        it('should upload a file and show invalid with no pubmed id or doi', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/invalidSleuthFileNoPubmedIdOrDOI.txt',
                { force: true }
            );
            cy.contains('Either DOI or PMID is required');
        });

        it('should upload a file and show invalid with invalid analysis', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/invalidSleuthFileIncorrectAnalysis.txt',
                { force: true }
            );
            cy.contains('Unexpected format');
        });

        it('should upload a file and show invalid with a semi colon', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/invalidSleuthFileSemiColon.txt',
                { force: true }
            );
            cy.contains('Did you omit a colon or use a semi colon instead of a colon?');
        });

        it('should upload a file and show invalid subjects', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/invalidSleuthFileSubjects.txt',
                { force: true }
            );
            cy.contains('Unexpected format');
        });

        it('should upload a file and show invalid format for wrong DOI format', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/invalidSleuthFilesBadDOIFormat.txt',
                { force: true }
            );
            cy.contains('Either DOI or PMID is required');
        });

        it('should upload a file and show invalid format for wrong author experiment name string (no colon delimiter)', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/invalidSleuthFileInvalidAuthor.txt',
                { force: true }
            );
            cy.contains('Unexpected format');
        });

        it('should disable the button for an invalid file', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/invalidSleuthFileInvalidAuthor.txt',
                { force: true }
            );
            cy.contains('button', 'next').should('be.disabled');
        });

        it('should disable the button if there is an invalid file in a multi file upload', () => {
            cy.get('input[type="file"]').selectFile(
                [
                    'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithDOI.txt',
                    'cypress/fixtures/ImportSleuth/sleuthFiles/invalidSleuthFileInvalidAuthor.txt',
                ],
                { force: true }
            );
            cy.contains('button', 'next').should('be.disabled');
        });
    });

    describe('should upload valid sleuth files', () => {
        it('should upload a valid file with a valid DOI', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithDOI.txt',
                { force: true }
            );
            cy.get('[data-testid="InsertDriveFileIcon"]').should('exist').and('be.visible');
        });

        it('should upload a valid file with a valid PMID', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithPMID.txt',
                { force: true }
            );
            cy.get('[data-testid="InsertDriveFileIcon"]').should('exist').and('be.visible');
        });

        it('should upload a valid file with a valid DOI and PMID', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithDOIAndPMID.txt',
                { force: true }
            );
            cy.get('[data-testid="InsertDriveFileIcon"]').should('exist').and('be.visible');
        });

        it('should upload multiple valid files', () => {
            cy.get('input[type="file"]').selectFile(
                [
                    'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithDOI.txt',
                    'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithPMID.txt',
                ],
                { force: true }
            );
            cy.get('[data-testid="InsertDriveFileIcon"]').should('have.length', 2);
        });

        it('should upload a valid sleuth file with windows line endings', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWindowsLineEndings.txt',
                { force: true }
            );
            cy.get('[data-testid="InsertDriveFileIcon"]').should('exist').and('be.visible');
            cy.contains('button', 'next').should('be.enabled');
        });

        it('should upload a valid sleuth file with wonky white space', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWonkyWhiteSpace.txt',
                { force: true }
            );
            cy.get('[data-testid="InsertDriveFileIcon"]').should('exist').and('be.visible');
            cy.contains('button', 'next').should('be.enabled');
        });

        it('should enable if a valid file is uploaded', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithDOI.txt',
                { force: true }
            );
            cy.contains('button', 'next').should('be.enabled');
        });

        it('should enable if multiple valid files are uploaded', () => {
            cy.get('input[type="file"]').selectFile(
                [
                    'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithDOI.txt',
                    'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithPMID.txt',
                ],
                { force: true }
            );
            cy.contains('button', 'next').should('be.enabled');
        });
    });

    describe('ingest sleuth files for a single file uploaded', () => {
        beforeEach(() => {
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/esearchSingleResponse.json',
                delay: 500,
            }).as('doiToPubmedQuery');
            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/efetchSingleResponse.xml',
                delay: 500,
            }).as('pmidsFetch');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/baseStudiesSingleSleuthStudyResponse.json',
                delay: 500,
            }).as('baseStudiesIngestFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');

            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithDOI.txt',
                { force: true }
            );
            cy.contains('button', 'next').click();
        });

        it('should show 0 progress initially', () => {
            cy.get('[aria-valuenow="0"]').should('exist');
        });

        it('should do the DOI => Pubmed query and show progress', () => {
            cy.wait('@doiToPubmedQuery').then((res) => {
                expect(res.request.query?.term).equals('some-doi.org');
            });
            cy.contains('Fetching study details').should('exist');
        });

        it('should query pubmed for study details and show progress', () => {
            cy.wait(['@doiToPubmedQuery', '@pmidsFetch']);
            cy.contains(/Adding .+ studies into the database/i).should('exist');
        });

        it('should fetch PMIDs', () => {
            cy.wait(['@pmidsFetch']);
            cy.contains(/Adding .+ studies into the database/i).should('be.visible');
        });

        it('should have the expected arguments during ingestion', () => {
            cy.wait('@baseStudiesIngestFixture').then((res) => {
                expect(res.request.body[0]?.doi).equals('some-doi.org');
            });

            cy.wait('@analysesPostFixture').then((res) => {
                expect(res.request.body.study).equals(
                    baseStudiesSingleSleuthStudyResponse[0].versions.find(
                        (version: { username: string; id: string }) => version.username === 'test-user'
                    )?.id
                );
            });
        });

        it('should complete ingestion and show import complete', () => {
            cy.wait('@analysesPostFixture');
            cy.contains(/import complete|ingestion complete/i).should('be.visible');
        });

        it('should create stubs after ingestion', () => {
            cy.wait('@analysesPostFixture');
            cy.contains('button', 'next').should('be.enabled');
        });
    });

    describe('edge cases', () => {
        it('should apply the pubmed details to the study if a matching pubmed study is found', () => {
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/esearchSingleResponse.json',
            }).as('doiToPubmedQuery');

            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/efetchSingleResponse.xml',
            }).as('pmidsFetch');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/baseStudiesMultipleSleuthStudyResponse.json',
            }).as('baseStudiesIngestFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');

            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithDOI.txt',
                { force: true }
            );
            cy.contains('button', 'next').click();

            cy.wait('@baseStudiesIngestFixture').then((baseStudiesResponse) => {
                const baseStudy = baseStudiesResponse.request.body[0];

                // we should still have all the data from the original base study created from the sleuth import file
                expect(baseStudy.authors).equals('Gerardin E,');
                expect(baseStudy.doi).equals('some-doi.org');
                expect(baseStudy.name).equals('The brains default mode network.');
                expect(baseStudy.year).equals(2000);
                expect(baseStudy.publication).equals('Annual review of neuroscience');
                // additional data should be added from the pubmed query if it did not exist
                expect(baseStudy.pmcid).equals('PMCTEST');
                expect(baseStudy.description).equals(
                    `\nThe brains default mode network consists of discrete, bilateral and symmetrical cortical areas, in the medial and lateral parietal, medial prefrontal, and medial and lateral temporal cortices of the human, nonhuman primate, cat, and rodent brains. Its discovery was an unexpected consequence of brain-imaging studies first performed with positron emission tomography in which various novel, attention-demanding, and non-self-referential tasks were compared with quiet repose either with eyes closed or with simple visual fixation. The default mode network consistently decreases its activity when compared with activity during these relaxed nontask states. The discovery of the default mode network reignited a longstanding interest in the significance of the brain's ongoing or intrinsic activity. Presently, studies of the brain's intrinsic activity, popularly referred to as resting-state studies, have come to play a major role in studies of the human brain in health and disease. The brain's default mode network plays a central role in this work.`
                );
            });
        });

        it('should do a POST request to /studies if the user does not own the study', () => {
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/esearchSingleResponse.json',
            }).as('doiToPubmedQuery');

            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/efetchSingleResponse.xml',
            }).as('pmidsFetch');

            cy.fixture('ImportSleuth/neurosynthResponses/baseStudiesSingleSleuthStudyResponse.json').then(
                (baseStudiesResponse: BaseStudy[]) => {
                    cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, [
                        {
                            ...baseStudiesResponse[0],
                            versions: [
                                ...(baseStudiesResponse[0].versions as StudyReturn[]).map((v) => ({
                                    ...v,
                                    user: 'other-user-sub',
                                })),
                            ],
                            user: 'other-user-sub',
                        },
                    ]).as('baseStudiesIngestFixture');
                }
            );

            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/studies/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/studySingleSleuthStudyResponse.json',
            }).as('studyPostFixture');

            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithDOI.txt',
                { force: true }
            );
            cy.contains('button', 'next').click();

            cy.get('@studyPostFixture').should('exist');
        });

        it('should not do a POST request to /studies if the user does own the study', () => {
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/esearchSingleResponse.json',
            }).as('doiToPubmedQuery');

            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/efetchSingleResponse.xml',
            }).as('pmidsFetch');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/baseStudiesSingleSleuthStudyResponse.json',
            }).as('baseStudiesIngestFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/studies/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/studySingleSleuthStudyResponse.json',
            }).as('studyPostFixture');

            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithDOI.txt',
                { force: true }
            );
            cy.contains('button', 'next').click();

            cy.get('@studyPostFixture.all').should('have.length', 0);
        });

        it('should do a POST request to /studies with multiple analyses if the user does not own the study', () => {
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/esearchSingleResponse.json',
            }).as('doiToPubmedQuery');

            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/efetchSingleResponse.xml',
            }).as('pmidsFetch');

            cy.fixture('ImportSleuth/neurosynthResponses/baseStudiesMultipleSleuthStudyResponse.json').then(
                (baseStudiesResponse: BaseStudyReturn[]) => {
                    cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, [
                        ...baseStudiesResponse.map((baseStudy) => ({
                            ...baseStudy,
                            user: 'other-user-sub',
                            versions: baseStudy.versions?.map((v: StudyReturn) => ({
                                ...v,
                                user: 'other-user-sub',
                            })),
                        })),
                    ]).as('baseStudiesIngestFixture');
                }
            );

            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/studies/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/studySingleSleuthStudyResponse.json',
            }).as('studyPostFixture');

            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileMultipleExperimentsSameDOI.txt',
                { force: true }
            );
            cy.contains('button', 'next').click();

            cy.wait('@studyPostFixture').then((interception) => {
                expect(interception.request.body.analyses.length).to.equal(3);
            });
        });

        it('should do a POST request to /analyses if the user does own the study', () => {
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/esearchSingleResponse.json',
            }).as('doiToPubmedQuery');

            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/efetchSingleResponse.xml',
            }).as('pmidsFetch');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/baseStudiesMultipleSleuthStudyResponse.json',
            }).as('baseStudiesIngestFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');

            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithDOI.txt',
                { force: true }
            );
            cy.contains('button', 'next').click();

            cy.get('@analysesPostFixture').should('exist');
        });

        it('should consolidate into a single study if there are multiple sleuth experiments that have the same DOI or ID', () => {
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?**/**`, {
                fixture: 'ImportSleuth/pubmedResponses/esearchSingleResponse.json',
            }).as('doiToPubmedQuery');

            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/efetchSingleResponse.xml',
            }).as('pmidsFetch');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/baseStudiesMultipleSleuthStudyResponse.json',
            }).as('baseStudiesIngestFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');

            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileMultipleExperimentsSameDOI.txt',
                { force: true }
            );
            cy.contains('button', 'next').click();

            cy.wait('@baseStudiesIngestFixture').then((baseStudiesResponse) => {
                expect(baseStudiesResponse.request?.body.length).equals(1);
            });
        });
    });

    describe('ingest multiple sleuth files', () => {
        it('should successfully upload and ingest multiple files', () => {
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/esearchSingleResponse.json',
            }).as('doiToPubmedQuery');
            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'ImportSleuth/pubmedResponses/efetchSingleResponse.xml',
            }).as('pmidsFetch');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/baseStudiesMultipleSleuthStudyResponse.json',
            }).as('baseStudiesIngestFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture: 'ImportSleuth/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');

            cy.get('input[type="file"]').selectFile(
                [
                    'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithDOI.txt',
                    'cypress/fixtures/ImportSleuth/sleuthFiles/validSleuthFileWithPMID.txt',
                ],
                { force: true }
            );
            cy.contains('button', 'next').click();

            // Should process both files
            cy.wait('@doiToPubmedQuery')
                .wait('@pmidsFetch')
                .wait('@baseStudiesIngestFixture')
                .wait('@analysesPostFixture')
                .wait('@pmidsFetch')
                .wait('@baseStudiesIngestFixture')
                .wait('@analysesPostFixture');

            cy.contains(/import complete|ingestion complete/i).should('be.visible');
            cy.contains('button', 'next').should('be.enabled');
        });
    });
});
