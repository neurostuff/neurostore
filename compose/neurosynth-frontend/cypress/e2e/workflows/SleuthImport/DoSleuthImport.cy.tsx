/// <reference types="cypress" />

import esearchSingleResponse from '../../../fixtures/DoSleuthImport/pubmedResponses/esearchSingleResponse.json';
import baseStudiesSingleSleuthStudyResponse from '../../../fixtures/DoSleuthImport/neurosynthResponses/baseStudiesSingleSleuthStudyResponse.json';
import baseStudiesMultipleSleuthStudyResponse from '../../../fixtures/DoSleuthImport/neurosynthResponses/baseStudiesMultipleSleuthStudyResponse.json';
import studysetsSingleSleuthStudyResponse from '../../../fixtures/DoSleuthImport/neurosynthResponses/studysetsSingleSleuthStudyResponse.json';
import analysesSingleSleuthStudyResponse from '../../../fixtures/DoSleuthImport/neurosynthResponses/analysesSingleSleuthStudyResponse.json';
import annotationsSingleSleuthStudyResponse from '../../../fixtures/DoSleuthImport/neurosynthResponses/annotationsSingleSleuthStudyResponse.json';

const PATH = '/projects/new/sleuth';

describe('DoSleuthImport', () => {
    const neurostoreAPIBaseURL = Cypress.env('neurostoreAPIBaseURL');
    const neurosynthAPIBaseURL = Cypress.env('neurosynthAPIBaseURL');

    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');

        cy.intercept('POST', `https://www.google-analytics.com/*/**`, {}).as(
            'googleAnalyticsFixture'
        );
    });

    it('should load successfully', () => {
        cy.login('mocked').visit(PATH);
    });

    describe('upload sleuth file', () => {
        beforeEach(() => {
            cy.login('mocked').visit(PATH);
            cy.contains('button', 'next').click();
        });

        describe('should upload invalid sleuth files', () => {
            it('should upload a file and show invalid with no reference', () => {
                cy.get('input[type="file"]').selectFile(
                    'cypress/fixtures/DoSleuthImport/sleuthFiles/invalidSleuthFileNoReference.txt',
                    { force: true }
                );
                cy.contains('No coordinate reference');
            });

            it('should upload a file and show invalid with no pubmed id or doi', () => {
                cy.get('input[type="file"]').selectFile(
                    'cypress/fixtures/DoSleuthImport/sleuthFiles/invalidSleuthFileNoPubmedIdOrDOI.txt',
                    { force: true }
                );
                cy.contains('Either DOI or PMID is required');
            });

            it('should upload a file and show invalid with invalid analysis', () => {
                cy.get('input[type="file"]').selectFile(
                    'cypress/fixtures/DoSleuthImport/sleuthFiles/invalidSleuthFileIncorrectAnalysis.txt',
                    { force: true }
                );
                cy.contains('Unexpected format');
            });

            it('should upload a file and show invalid with a semi colon', () => {
                cy.get('input[type="file"]').selectFile(
                    'cypress/fixtures/DoSleuthImport/sleuthFiles/invalidSleuthFileSemiColon.txt',
                    { force: true }
                );
                cy.contains('Did you omit a colon or use a semi colon instead of a colon?');
            });

            it('should upload a file and show invalid subjects', () => {
                cy.get('input[type="file"]').selectFile(
                    'cypress/fixtures/DoSleuthImport/sleuthFiles/invalidSleuthFileSubjects.txt',
                    { force: true }
                );
                cy.contains('Unexpected format');
            });

            it('should upload a file and show invalid format for wrong DOI format', () => {
                cy.get('input[type="file"]').selectFile(
                    'cypress/fixtures/DoSleuthImport/sleuthFiles/invalidSleuthFilesBadDOIFormat.txt',
                    { force: true }
                );
                cy.contains('Either DOI or PMID is required');
            });

            it('should upload a file and show invalid format for wrong author experiment name string (no colon delimiter)', () => {
                cy.get('input[type="file"]').selectFile(
                    'cypress/fixtures/DoSleuthImport/sleuthFiles/invalidSleuthFileInvalidAuthor.txt',
                    { force: true }
                );
                cy.contains('Unexpected format');
            });

            it('should disable the button for an invalid file', () => {
                cy.get('input[type="file"]').selectFile(
                    'cypress/fixtures/DoSleuthImport/sleuthFiles/invalidSleuthFileInvalidAuthor.txt',
                    { force: true }
                );
                cy.contains('button', 'create project').should('be.disabled');
            });

            it('should disable the button if there is an invalid file in a multi file upload', () => {
                cy.get('input[type="file"]').selectFile(
                    [
                        'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithDOI.txt',
                        'cypress/fixtures/DoSleuthImport/sleuthFiles/invalidSleuthFileInvalidAuthor.txt',
                    ],
                    { force: true }
                );
                cy.contains('button', 'create project').should('be.disabled');
            });
        });

        describe('should upload valid sleuth files', () => {
            it('should upload a valid file with a valid DOI', () => {
                cy.get('input[type="file"]').selectFile(
                    'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithDOI.txt',
                    { force: true }
                );
                cy.get('[data-testid="InsertDriveFileIcon"]').should('exist').and('be.visible');
            });

            it('should upload a valid file with a valid PMID', () => {
                cy.get('input[type="file"]').selectFile(
                    'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithPMID.txt',
                    { force: true }
                );
                cy.get('[data-testid="InsertDriveFileIcon"]').should('exist').and('be.visible');
            });

            it('should upload a valid file with a valid DOI and PMID', () => {
                cy.get('input[type="file"]').selectFile(
                    'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithDOIAndPMID.txt',
                    { force: true }
                );
                cy.get('[data-testid="InsertDriveFileIcon"]').should('exist').and('be.visible');
            });

            it('should upload multiple valid files', () => {
                cy.get('input[type="file"]').selectFile(
                    [
                        'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithDOI.txt',
                        'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithPMID.txt',
                    ],
                    { force: true }
                );
                cy.get('[data-testid="InsertDriveFileIcon"]').should('have.length', 2);
            });

            it('should enable if a valid file is uploaded', () => {
                cy.get('input[type="file"]').selectFile(
                    'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithDOI.txt',
                    { force: true }
                );
                cy.contains('button', 'create project').should('be.enabled');
            });

            it('should enable if multiple valid files are uploaded', () => {
                cy.get('input[type="file"]').selectFile(
                    [
                        'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithDOI.txt',
                        'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithPMID.txt',
                    ],
                    { force: true }
                );
                cy.contains('button', 'create project').should('be.enabled');
            });
        });

        it('should be disabled by default', () => {
            cy.contains('button', 'create project').should('be.disabled');
        });
    });

    describe('build project for a single file uploaded', () => {
        beforeEach(() => {
            // synth API responses
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
                fixture: 'DoSleuthImport/pubmedResponses/esearchSingleResponse.json',
                delay: 500,
            }).as('doiToPubmedQuery');
            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'DoSleuthImport/pubmedResponses/efetchSingleResponse.xml',
                delay: 500,
            }).as('pmidsFetch');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/baseStudiesSingleSleuthStudyResponse.json',
                delay: 500,
            }).as('baseStudiesIngestFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/studysets/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/studysetsSingleSleuthStudyResponse.json',
                delay: 500,
            }).as('studysetsPostFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/annotations/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/annotationsSingleSleuthStudyResponse.json',
                delay: 500,
            }).as('annotationsPostFixture');

            // compose API responses
            cy.intercept('POST', `${neurosynthAPIBaseURL}/projects**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
                delay: 500,
            }).as('projectsPostFixture');

            cy.intercept('GET', `${neurosynthAPIBaseURL}/projects/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
            }).as('projectsGetFixture');
            cy.login('mocked').visit(PATH);
            cy.contains('button', 'next').click();
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithDOI.txt',
                { force: true }
            );
            cy.contains('button', 'create project').click();
        });

        it('should show 0 progress initially', () => {
            cy.get('[aria-valuenow="0"]').should('exist');
        });

        it('should move to the build project view, do the DOI => Pubmed query, and show progress', () => {
            cy.wait('@doiToPubmedQuery').then((res) => {
                expect(res.request.query?.term).equals('some-doi.org');
            });
            cy.contains('Fetching study details').should('exist');
            cy.get('[aria-valuenow="40"]').should('exist');
        });

        it('should query pubmed for study details and show progress', () => {
            cy.wait(['@doiToPubmedQuery', '@pmidsFetch']).then((res) => {
                expect(res[1].request.body as string).contains(
                    `id=${esearchSingleResponse.esearchresult.idlist[0]}`
                );
            });
            cy.contains('Adding studies from').should('exist');
            cy.get('[aria-valuenow="40"]').should('exist');
        });

        it('should fetch PMIDs and show progress', () => {
            cy.wait(['@pmidsFetch']);
            cy.contains('Adding studies from').should('be.visible');
        });

        it('should have the expected arguments during ingestion', () => {
            cy.wait('@baseStudiesIngestFixture').then((res) => {
                expect(res.request.body[0]?.doi).equals('some-doi.org');
            });

            cy.wait('@analysesPostFixture').then((res) => {
                expect(res.request.body.study).equals(
                    baseStudiesSingleSleuthStudyResponse[0].versions.find(
                        (version) => version.username === 'test-user'
                    )?.id
                );
            });
        });

        it('should begin creating the studyset and show progress', () => {
            cy.wait('@analysesPostFixture');
            cy.contains('Creating studyset').should('be.visible');
            cy.get('[aria-valuenow="85"]').should('exist');
        });

        it('should begin creating the annotation and show progress', () => {
            cy.wait('@studysetsPostFixture', { timeout: 10000 }).then((res) => {
                expect(res.request.body.name).equals('Studyset for Untitled sleuth project');
                expect(res.request.body.studies).deep.equals(
                    studysetsSingleSleuthStudyResponse.studies
                );
            });
            cy.contains('Creating annotation...').should('be.visible');
            cy.get('[aria-valuenow="90"]').should('exist');
        });

        it('should create the correct annotation keys and notes', () => {
            cy.wait('@annotationsPostFixture').then((res) => {
                const notes = [
                    {
                        analysis: analysesSingleSleuthStudyResponse.id,
                        study: analysesSingleSleuthStudyResponse.study,
                        note: {
                            included: true,
                            validSleuthFileWithDOI_txt: true,
                        },
                    },
                ];
                expect(res.request.body.name).equals('Annotation for Untitled sleuth project');
                expect(res.request.body.note_keys).deep.equals({
                    included: 'boolean',
                    validSleuthFileWithDOI_txt: 'boolean',
                });

                expect(res.request.body.notes).deep.equals(notes);
            });
        });

        it('should show the import summary', () => {
            cy.wait('@projectsPostFixture', { timeout: 10000 }).then((res) => {
                expect(res.request.body.name).equals('Untitled sleuth project');
                expect(res.request.body.description).equals(
                    'New project generated from files: validSleuthFileWithDOI.txt'
                );
                expect(res.request.body.provenance.extractionMetadata.annotationId).equals(
                    annotationsSingleSleuthStudyResponse.id
                );
                expect(res.request.body.provenance.extractionMetadata.studysetId).equals(
                    studysetsSingleSleuthStudyResponse.id
                );
            });
            cy.contains('Import Complete').should('be.visible');
        });
    });

    describe('build meta analyses', () => {
        beforeEach(() => {
            // synth API responses
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
                fixture: 'DoSleuthImport/pubmedResponses/esearchSingleResponse.json',
            }).as('doiToPubmedQuery');
            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'DoSleuthImport/pubmedResponses/efetchSingleResponse.xml',
            }).as('pmidsFetch');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/baseStudiesSingleSleuthStudyResponse.json',
            }).as('baseStudiesIngestFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/studysets/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/studysetsSingleSleuthStudyResponse.json',
            }).as('studysetsPostFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/annotations/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/annotationsSingleSleuthStudyResponse.json',
            }).as('annotationsPostFixture');

            // compose API responses
            cy.intercept('POST', `${neurosynthAPIBaseURL}/projects**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
            }).as('projectsPostFixture');

            cy.intercept('GET', `${neurosynthAPIBaseURL}/projects/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
            }).as('projectsGetFixture');

            cy.intercept('POST', `${neurosynthAPIBaseURL}/specifications**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/specificationsSingleSleuthStudyResponse.json',
            }).as('specificationPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/studysets**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeStudysetsSingleSleuthStudyResponse.json',
            }).as('composeStudysetsPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/annotations**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeAnnotationsSingleSleuthStudyResponse.json',
            }).as('composeAnnotationsPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/meta-analyses**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeMetaAnalysesSingleSleuthStudyResponse.json',
            }).as('composeMetaAnalysesPostFixture');
            cy.intercept('GET', `${neurosynthAPIBaseURL}/meta-analyses**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeGetMetaAnalysesSingleSleuthStudyResponse.json',
            }).as('composeGetMetaAnalysesPostFixture');

            cy.login('mocked').visit(PATH);
            cy.contains('button', 'next').click();
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithDOI.txt',
                { force: true }
            );
            cy.contains('button', 'create project').click();
            cy.wait([
                '@doiToPubmedQuery',
                '@pmidsFetch',
                '@baseStudiesIngestFixture',
                '@analysesPostFixture',
                '@studysetsPostFixture',
                '@annotationsPostFixture',
                '@projectsPostFixture',
            ]);
            cy.contains('button', 'next').click();
        });

        it('should go to the meta analysis page', () => {
            cy.contains('Would you like to create a meta-analysis').should('be.visible');
        });

        it('should show the meta analyses options', () => {
            cy.contains('button', 'Yes').click();
            cy.contains('ALE');
            cy.contains('MKDADensity');
        });

        it('should select ALE and create an ALE meta analysis', () => {
            cy.contains('button', 'Yes').click();
            cy.get('[type="radio"]').first().click();
            cy.contains('button', 'create')
                .click()
                .wait('@specificationPostFixture')
                .then((res) => {
                    expect(res.request.body?.estimator?.type).equals('ALE');
                });
        });

        it('should select MKDA and create an MKDA meta analysis', () => {
            cy.contains('button', 'Yes').click();
            cy.get('[type="radio"]').eq(1).click();
            cy.contains('button', 'create')
                .click()
                .wait('@specificationPostFixture')
                .then((res) => {
                    expect(res.request.body?.estimator?.type).equals('MKDADensity');
                });
        });
    });

    describe('edge cases', () => {
        it.only('should apply the pubmed details to the study if a matching pubmed study is found', () => {
            // this stuff exists just to make sure cypress doesnt send any real requests. They are not under test
            // synth API responses
            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/studysets/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/studysetsSingleSleuthStudyResponse.json',
            }).as('studysetsPostFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/annotations/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/annotationsSingleSleuthStudyResponse.json',
            }).as('annotationsPostFixture');

            // compose API responses
            cy.intercept('POST', `${neurosynthAPIBaseURL}/projects**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
            }).as('projectsPostFixture');

            cy.intercept('GET', `${neurosynthAPIBaseURL}/projects/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
            }).as('projectsGetFixture');

            cy.intercept('POST', `${neurosynthAPIBaseURL}/specifications**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/specificationsSingleSleuthStudyResponse.json',
            }).as('specificationPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/studysets**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeStudysetsSingleSleuthStudyResponse.json',
            }).as('composeStudysetsPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/annotations**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeAnnotationsSingleSleuthStudyResponse.json',
            }).as('composeAnnotationsPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/meta-analyses**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeMetaAnalysesSingleSleuthStudyResponse.json',
            }).as('composeMetaAnalysesPostFixture');
            cy.intercept('GET', `${neurosynthAPIBaseURL}/meta-analyses/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeGetMetaAnalysesSingleSleuthStudyResponse.json',
            }).as('composeGetMetaAnalysesPostFixture');

            // this stuff is the important stuff needed for the test
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
                fixture: 'DoSleuthImport/pubmedResponses/esearchSingleResponse.json',
            }).as('doiToPubmedQuery');

            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'DoSleuthImport/pubmedResponses/efetchSingleResponse.xml',
            }).as('pmidsFetch');

            // this is not important but is needed to finish the rest of the import
            cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/baseStudiesMultipleSleuthStudyResponse.json',
            }).as('baseStudiesIngestFixture');

            cy.login('mocked').visit(PATH);
            cy.contains('button', 'next').click();
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithDOI.txt',
                { force: true }
            );
            cy.contains('button', 'create project').click();

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

        it('should go to the build step and do a POST request to /studies if the user does not own the study', () => {
            // this stuff exists just to make sure cypress doesnt send any real requests. They are not under test
            // synth API responses
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
                fixture: 'DoSleuthImport/pubmedResponses/esearchSingleResponse.json',
            }).as('doiToPubmedQuery');

            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'DoSleuthImport/pubmedResponses/efetchSingleResponse.xml',
            }).as('pmidsFetch');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/baseStudiesMultipleSleuthStudyResponse.json',
            }).as('baseStudiesIngestFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/studysets/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/studysetsSingleSleuthStudyResponse.json',
            }).as('studysetsPostFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/annotations/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/annotationsSingleSleuthStudyResponse.json',
            }).as('annotationsPostFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/studies/**`, {
                fixture: 'DoSleuthImport/neurosynthResponses/studySingleSleuthStudyResponse.json',
            }).as('studyPostFixture');

            // compose API responses
            cy.intercept('POST', `${neurosynthAPIBaseURL}/projects**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
            }).as('projectsPostFixture');

            cy.intercept('GET', `${neurosynthAPIBaseURL}/projects/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
            }).as('projectsGetFixture');

            cy.intercept('POST', `${neurosynthAPIBaseURL}/specifications**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/specificationsSingleSleuthStudyResponse.json',
            }).as('specificationPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/studysets**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeStudysetsSingleSleuthStudyResponse.json',
            }).as('composeStudysetsPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/annotations**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeAnnotationsSingleSleuthStudyResponse.json',
            }).as('composeAnnotationsPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/meta-analyses**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeMetaAnalysesSingleSleuthStudyResponse.json',
            }).as('composeMetaAnalysesPostFixture');
            cy.intercept('GET', `${neurosynthAPIBaseURL}/meta-analyses/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeGetMetaAnalysesSingleSleuthStudyResponse.json',
            }).as('composeGetMetaAnalysesPostFixture');

            // this stuff is the important stuff needed for the test

            cy.login('mocked', { sub: 'other-user-sub' }).visit(PATH);
            cy.contains('button', 'next').click();
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithDOI.txt',
                { force: true }
            );
            cy.contains('button', 'create project').click();

            cy.get('@studyPostFixture').should('exist');
        });

        it('should go to the build step and do a POST request to /studies with multiple analyses if the user does not own the study', () => {
            // this stuff exists just to make sure cypress doesnt send any real requests. They are not under test
            // synth API responses
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
                fixture: 'DoSleuthImport/pubmedResponses/esearchSingleResponse.json',
            }).as('doiToPubmedQuery');

            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'DoSleuthImport/pubmedResponses/efetchSingleResponse.xml',
            }).as('pmidsFetch');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/baseStudiesMultipleSleuthStudyResponse.json',
            }).as('baseStudiesIngestFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/studysets/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/studysetsSingleSleuthStudyResponse.json',
            }).as('studysetsPostFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/annotations/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/annotationsSingleSleuthStudyResponse.json',
            }).as('annotationsPostFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/studies/**`, {
                fixture: 'DoSleuthImport/neurosynthResponses/studySingleSleuthStudyResponse.json',
            }).as('studyPostFixture');

            // compose API responses
            cy.intercept('POST', `${neurosynthAPIBaseURL}/projects**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
            }).as('projectsPostFixture');

            cy.intercept('GET', `${neurosynthAPIBaseURL}/projects/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
            }).as('projectsGetFixture');

            cy.intercept('POST', `${neurosynthAPIBaseURL}/specifications**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/specificationsSingleSleuthStudyResponse.json',
            }).as('specificationPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/studysets**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeStudysetsSingleSleuthStudyResponse.json',
            }).as('composeStudysetsPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/annotations**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeAnnotationsSingleSleuthStudyResponse.json',
            }).as('composeAnnotationsPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/meta-analyses**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeMetaAnalysesSingleSleuthStudyResponse.json',
            }).as('composeMetaAnalysesPostFixture');
            cy.intercept('GET', `${neurosynthAPIBaseURL}/meta-analyses/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeGetMetaAnalysesSingleSleuthStudyResponse.json',
            }).as('composeGetMetaAnalysesPostFixture');

            // this stuff is the important stuff needed for the test

            cy.login('mocked', { sub: 'other-user-sub' }).visit(PATH);
            cy.contains('button', 'next').click();
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileMultipleExperimentsSameDOI.txt',
                { force: true }
            );
            cy.contains('button', 'create project').click();

            cy.wait('@studyPostFixture').then((res) => {
                expect(res.request.body.analyses.length).equals(3);
            });
        });

        it('should go to the build step and do a POST request to /analyses if the user does own the study. The best version should be selected', () => {
            // this stuff exists just to make sure cypress doesnt send any real requests. They are not under test
            // synth API responses
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
                fixture: 'DoSleuthImport/pubmedResponses/esearchSingleResponse.json',
            }).as('doiToPubmedQuery');

            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'DoSleuthImport/pubmedResponses/efetchSingleResponse.xml',
            }).as('pmidsFetch');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/baseStudiesMultipleSleuthStudyResponse.json',
            }).as('baseStudiesIngestFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/studysets/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/studysetsSingleSleuthStudyResponse.json',
            }).as('studysetsPostFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/annotations/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/annotationsSingleSleuthStudyResponse.json',
            }).as('annotationsPostFixture');

            // compose API responses
            cy.intercept('POST', `${neurosynthAPIBaseURL}/projects**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
            }).as('projectsPostFixture');

            cy.intercept('GET', `${neurosynthAPIBaseURL}/projects/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
            }).as('projectsGetFixture');

            cy.intercept('POST', `${neurosynthAPIBaseURL}/specifications**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/specificationsSingleSleuthStudyResponse.json',
            }).as('specificationPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/studysets**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeStudysetsSingleSleuthStudyResponse.json',
            }).as('composeStudysetsPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/annotations**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeAnnotationsSingleSleuthStudyResponse.json',
            }).as('composeAnnotationsPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/meta-analyses**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeMetaAnalysesSingleSleuthStudyResponse.json',
            }).as('composeMetaAnalysesPostFixture');
            cy.intercept('GET', `${neurosynthAPIBaseURL}/meta-analyses/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeGetMetaAnalysesSingleSleuthStudyResponse.json',
            }).as('composeGetMetaAnalysesPostFixture');

            // this stuff is the important stuff needed for the test

            cy.login('mocked').visit(PATH);
            cy.contains('button', 'next').click();
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithDOI.txt',
                { force: true }
            );
            cy.contains('button', 'create project').click();

            cy.get('@analysesPostFixture').should('exist');
        });

        it('should consolidate into a single study if there are multiple sleuth experiments that have the same DOI or ID', () => {
            // this stuff exists just to make sure cypress doesnt send any real requests. They are not under test
            // synth API responses
            cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?**/**`, {
                fixture: 'DoSleuthImport/pubmedResponses/esearchSingleResponse.json',
            }).as('doiToPubmedQuery');

            cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
                fixture: 'DoSleuthImport/pubmedResponses/efetchSingleResponse.xml',
            }).as('pmidsFetch');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/baseStudiesMultipleSleuthStudyResponse.json',
            }).as('baseStudiesIngestFixture');

            cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
            }).as('analysesPostFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/studysets/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/studysetsSingleSleuthStudyResponse.json',
            }).as('studysetsPostFixture');
            cy.intercept('POST', `${neurostoreAPIBaseURL}/annotations/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/annotationsSingleSleuthStudyResponse.json',
            }).as('annotationsPostFixture');

            // compose API responses
            cy.intercept('POST', `${neurosynthAPIBaseURL}/projects**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
            }).as('projectsPostFixture');

            cy.intercept('GET', `${neurosynthAPIBaseURL}/projects/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
            }).as('projectsGetFixture');

            cy.intercept('POST', `${neurosynthAPIBaseURL}/specifications**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/specificationsSingleSleuthStudyResponse.json',
            }).as('specificationPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/studysets**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeStudysetsSingleSleuthStudyResponse.json',
            }).as('composeStudysetsPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/annotations**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeAnnotationsSingleSleuthStudyResponse.json',
            }).as('composeAnnotationsPostFixture');
            cy.intercept('POST', `${neurosynthAPIBaseURL}/meta-analyses**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeMetaAnalysesSingleSleuthStudyResponse.json',
            }).as('composeMetaAnalysesPostFixture');
            cy.intercept('GET', `${neurosynthAPIBaseURL}/meta-analyses/**`, {
                fixture:
                    'DoSleuthImport/neurosynthResponses/composeGetMetaAnalysesSingleSleuthStudyResponse.json',
            }).as('composeGetMetaAnalysesPostFixture');

            // this stuff is the important stuff needed for the test

            cy.login('mocked').visit(PATH);
            cy.contains('button', 'next').click();
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileMultipleExperimentsSameDOI.txt',
                { force: true }
            );
            cy.contains('button', 'create project').click();

            cy.wait('@baseStudiesIngestFixture').then((baseStudiesResponse) => {
                expect(baseStudiesResponse.request?.body.length).equals(1);
            });
        });
    });

    it('should go through the whole workflow and successfully upload multiple files', () => {
        // synth API responses
        cy.intercept('GET', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**`, {
            fixture: 'DoSleuthImport/pubmedResponses/esearchSingleResponse.json',
        }).as('doiToPubmedQuery');
        cy.intercept('POST', `*//eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi**`, {
            fixture: 'DoSleuthImport/pubmedResponses/efetchSingleResponse.xml',
        }).as('pmidsFetch');
        cy.intercept('POST', `${neurostoreAPIBaseURL}/base-studies/**`, {
            fixture:
                'DoSleuthImport/neurosynthResponses/baseStudiesMultipleSleuthStudyResponse.json',
        }).as('baseStudiesIngestFixture');
        cy.intercept('POST', `${neurostoreAPIBaseURL}/analyses/**`, {
            fixture: 'DoSleuthImport/neurosynthResponses/analysesSingleSleuthStudyResponse.json',
        }).as('analysesPostFixture');
        cy.intercept('POST', `${neurostoreAPIBaseURL}/studysets/**`, {
            fixture: 'DoSleuthImport/neurosynthResponses/studysetsSingleSleuthStudyResponse.json',
        }).as('studysetsPostFixture');
        cy.intercept('POST', `${neurostoreAPIBaseURL}/annotations/**`, {
            fixture: 'DoSleuthImport/neurosynthResponses/annotationsSingleSleuthStudyResponse.json',
        }).as('annotationsPostFixture');

        // compose API responses
        cy.intercept('POST', `${neurosynthAPIBaseURL}/projects**`, {
            fixture: 'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
        }).as('projectsPostFixture');

        cy.intercept('GET', `${neurosynthAPIBaseURL}/projects/**`, {
            fixture: 'DoSleuthImport/neurosynthResponses/projectsSingleSleuthStudyResponse.json',
        }).as('projectsGetFixture');

        cy.intercept('POST', `${neurosynthAPIBaseURL}/specifications**`, {
            fixture:
                'DoSleuthImport/neurosynthResponses/specificationsSingleSleuthStudyResponse.json',
        }).as('specificationPostFixture');
        cy.intercept('POST', `${neurosynthAPIBaseURL}/studysets**`, {
            fixture:
                'DoSleuthImport/neurosynthResponses/composeStudysetsSingleSleuthStudyResponse.json',
        }).as('composeStudysetsPostFixture');
        cy.intercept('POST', `${neurosynthAPIBaseURL}/annotations**`, {
            fixture:
                'DoSleuthImport/neurosynthResponses/composeAnnotationsSingleSleuthStudyResponse.json',
        }).as('composeAnnotationsPostFixture');
        cy.intercept('POST', `${neurosynthAPIBaseURL}/meta-analyses**`, {
            fixture:
                'DoSleuthImport/neurosynthResponses/composeMetaAnalysesSingleSleuthStudyResponse.json',
        }).as('composeMetaAnalysesPostFixture');
        cy.intercept('GET', `${neurosynthAPIBaseURL}/meta-analyses/**`, {
            fixture:
                'DoSleuthImport/neurosynthResponses/composeGetMetaAnalysesSingleSleuthStudyResponse.json',
        }).as('composeGetMetaAnalysesPostFixture');

        cy.login('mocked').visit(PATH);
        cy.contains('button', 'next').click();
        // upload page
        cy.get('input[type="file"]').selectFile(
            [
                'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithDOI.txt',
                'cypress/fixtures/DoSleuthImport/sleuthFiles/validSleuthFileWithPMID.txt',
            ],
            { force: true }
        );
        cy.contains('button', 'create project').click();

        // build page
        cy.wait('@doiToPubmedQuery')
            .wait('@pmidsFetch')
            .wait('@baseStudiesIngestFixture')
            .wait('@analysesPostFixture')
            .wait('@pmidsFetch')
            .wait('@baseStudiesIngestFixture')
            .wait('@analysesPostFixture')
            .wait('@studysetsPostFixture')
            .wait('@annotationsPostFixture')
            .wait('@projectsPostFixture');

        cy.contains('button', 'next').click();

        // meta analysis page
        cy.wait('@projectsGetFixture');
        cy.contains('button', 'Yes').click();
        cy.get('[type="radio"]').first().click();
        cy.contains('button', 'create').click();
        cy.wait('@specificationPostFixture')
            .wait('@composeAnnotationsPostFixture')
            .wait('@composeMetaAnalysesPostFixture');
    });
});
