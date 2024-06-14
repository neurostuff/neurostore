/// <reference types="cypress" />

describe('ImportStudiesDialog', () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'projects/projectExtractionStep',
        }).as('projectFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
    });

    it('should load the page', () => {
        cy.visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');
    });

    it('should open the import studies dialog', () => {
        cy.login('mocked')
            .visit('/projects/abc123/curation')
            .wait('@projectFixture')
            .wait('@studysetFixture');
        cy.contains('button', 'import studies').click();
        cy.get('.MuiFormControl-root').should('be.visible');
        cy.url().should('include', '/projects/abc123/curation/import');
    });

    describe('Import via Neurostore', () => {
        beforeEach(() => {
            cy.login('mocked').visit('/projects/abc123/curation');
            cy.intercept('GET', '**/api/base-studies/**', {
                fixture: 'baseStudies/baseStudiesWithResults',
            }).as('baseStudiesFixture');
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            cy.visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');
            cy.contains('button', 'import studies').click();
            cy.contains('button', 'next').click();
        });

        it('should show the neurostore search page', () => {
            // we can target the table as the neurostore search is the only table HTML that appears in this workflow
            cy.get('.MuiTableContainer-root').should('be.visible');
        });

        it('should be disabled initially', () => {
            cy.wait('@baseStudiesFixture').then((baseStudiesResponse) => {
                cy.contains(
                    'button',
                    `Import ${baseStudiesResponse.response?.body?.results?.length} studies from neurostore`
                ).click();
            });
            cy.contains('button', 'next').should('be.disabled');
        });

        it('should import studies', () => {
            cy.wait('@baseStudiesFixture').then((baseStudiesResponse) => {
                cy.contains(
                    'button',
                    `Import ${baseStudiesResponse.response?.body?.results?.length} studies from neurostore`
                ).click();
            });
            cy.get('input').type('my new import{enter}');
            cy.contains('button', 'next')
                .click()
                .url()
                .should('include', '/projects/abc123/curation');
        });
    });

    describe('Import via Pubmed IDs', () => {
        beforeEach(() => {
            cy.login('mocked')
                .visit('/projects/abc123/curation')
                .wait('@projectFixture')
                .wait('@studysetFixture');
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            // not going to mock this for now as cypress does not seem to support XML fixtures
            // cy.intercept('POST', 'https://eutils.ncbi.nlm.nih.gov/**', {
            //     fixture: 'NIHPMIDResponse',
            // }).as('NIHPMIDFixture.xml');
            cy.contains('button', 'import studies').click();
            cy.contains(/PMID/).click();
            cy.contains('button', 'next').click();
        });

        it('should show the pmid input page', () => {
            cy.get(
                'textarea[placeholder="Enter list of pubmed IDs separated by a newline"]'
            ).should('be.visible');
        });

        it('should be disabled initially', () => {
            cy.contains('button', 'next').should('be.disabled');
        });

        it('should be enabled when an input is entered', () => {
            cy.get('textarea[placeholder="Enter list of pubmed IDs separated by a newline"]')
                .click()
                .type('123{enter}456{enter}789');
            cy.contains('button', 'next').should('not.be.disabled');
        });

        it('should show invalid for invalid input', () => {
            cy.get('textarea[placeholder="Enter list of pubmed IDs separated by a newline"]')
                .click()
                .type('123{enter}456{enter}789A');
            cy.contains(/format is incorrect/);
            cy.contains('button', 'next').should('be.disabled');
        });

        it('should import studies', () => {
            cy.get('textarea[placeholder="Enter list of pubmed IDs separated by a newline"]')
                .click()
                .type('123{enter}456{enter}789');
            cy.contains('button', 'next').click();
            cy.get('input').type('my new import{enter}');
            cy.contains('button', 'next')
                .click()
                .url()
                .should('include', '/projects/abc123/curation');
        });

        it('should import studies via a file', () => {
            cy.get('label[role="button"]').selectFile('cypress/fixtures/pmids.txt');
            cy.contains('button', 'next').should('not.be.disabled');
        });
    });

    describe('Manually create a new study', () => {
        beforeEach(() => {
            cy.login('mocked')
                .visit('/projects/abc123/curation')
                .wait('@projectFixture')
                .wait('@studysetFixture');
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            cy.contains('button', 'import studies').click();
            cy.contains('Manually create a new study').click();
            cy.contains('button', 'next').click();
        });

        it('should show the create new study page', () => {
            cy.contains('label', 'Study Name *').should('be.visible');
            cy.contains('label', 'Authors').should('be.visible');
            cy.contains('label', 'DOI').should('be.visible');
            cy.contains('label', 'Journal').should('be.visible');
            cy.contains('label', 'PubMed ID').should('be.visible');
            cy.contains('label', 'PubMed Central ID').should('be.visible');
            cy.contains('label', 'Article Year').should('be.visible');
            cy.contains('label', 'article link').should('be.visible');
            cy.contains('label', 'Keywords').should('be.visible');
            cy.contains('label', 'select study data source *').should('be.visible');
        });

        it('should be disabled initially', () => {
            cy.contains('button', 'next').should('be.disabled');
        });

        it('should be enabled when name and source are entered', () => {
            cy.get('input[placeholder="My study name"]').click().type('new study');
            cy.get('input[role="combobox"]').click();
            cy.contains('li', 'Neurostore').click();
            cy.contains('button', 'next').should('not.be.disabled');
        });

        it('should import studies', () => {
            cy.get('input[placeholder="My study name"]').click().type('new study');
            cy.get('input[role="combobox"]').click();
            cy.contains('li', 'Neurostore').click();
            cy.contains('button', 'next').click();
            cy.get('input').type('my new import{enter}');
            cy.contains('button', 'next')
                .click()
                .url()
                .should('include', '/projects/abc123/curation');
        });
    });

    describe('Import via File Format', () => {
        beforeEach(() => {
            cy.login('mocked')
                .visit('/projects/abc123/curation')
                .wait('@projectFixture')
                .wait('@studysetFixture');
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            cy.contains('button', 'import studies').click();
            cy.contains('Import via File Format').click();
            cy.contains('button', 'next').click();
        });

        it('should show the standard file import page', () => {
            cy.contains(/enter data source/).should('be.visible');
        });

        it('should disable the next button initially', () => {
            cy.contains('button', 'next').should('be.disabled');
        });

        it('should set the source and show the input', () => {
            cy.get('input[role="combobox"').click();
            cy.contains('li', 'Scopus').click();
            cy.get('textarea').should('be.visible');
            cy.contains(/Input is empty/).should('be.visible');
        });

        it('should set the sources and enable the next button', () => {
            cy.get('input[role="combobox"').click();
            cy.contains('li', 'Scopus').click();
            cy.get('textarea[placeholder="paste in valid endnote, bibtex, or RIS syntax"]')
                .click()
                .type(
                    `%0 Journal Article\n%T Role of the anterior insula in task-level control and focal attention\n%A Nelson, Steven M\n%A Dosenbach, Nico UF\n%A Cohen, Alexander L\n%A Wheeler, Mark E\n%A Schlaggar, Bradley L\n%A Petersen, Steven E\n%J Brain structure and function\n%V 214\n%669-680\n%@ 1863-2653\n%D 2010\n%I Springer-Verlag\n`,
                    {
                        delay: 1,
                    }
                );

            cy.contains('button', 'next').should('not.be.disabled');
        });

        it('should show an error message', () => {
            cy.get('input[role="combobox"').click();
            cy.contains('li', 'Scopus').click();
            cy.get('textarea[placeholder="paste in valid endnote, bibtex, or RIS syntax"]').type(
                'INVALID FORMAT'
            );
            cy.contains(/Format is incorrect/).should('be.visible');
        });

        it('should import studies', () => {
            cy.get('input[role="combobox"').click();
            cy.contains('li', 'Scopus').click();
            cy.get('textarea[placeholder="paste in valid endnote, bibtex, or RIS syntax"]')
                .click()
                .type(
                    `%0 Journal Article\n%T Role of the anterior insula in task-level control and focal attention\n%A Nelson, Steven M\n%A Dosenbach, Nico UF\n%A Cohen, Alexander L\n%A Wheeler, Mark E\n%A Schlaggar, Bradley L\n%A Petersen, Steven E\n%J Brain structure and function\n%V 214\n%669-680\n%@ 1863-2653\n%D 2010\n%I Springer-Verlag\n`,
                    {
                        delay: 1,
                    }
                );

            cy.contains('button', 'next').click();
            cy.get('input').type('my new import{enter}');
            cy.contains('button', 'next')
                .click()
                .url()
                .should('include', '/projects/abc123/curation');
        });

        it('should upload a onenote (ENW) file', () => {
            cy.get('input[role="combobox"').click();
            cy.contains('li', 'Scopus').click();
            cy.get('label[role="button"]').selectFile(
                'cypress/fixtures/standardFiles/onenoteStudies.txt'
            );
            cy.contains('button', 'next').should('be.visible');
        });

        // TODO : create a test for importing bibtex file
        // it('should import studies via a file', () => {})

        // TODO : create a test for importing RIS file
        // it('should import studies via a file', () => {})
    });

    describe('IMPORT DUPLICATES', () => {
        beforeEach(() => {
            cy.login('mocked')
                .visit('/projects/abc123/curation')
                .wait('@projectFixture')
                .wait('@studysetFixture');
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            cy.contains('button', 'import studies').click();
            cy.contains('Import via File Format').click();
            cy.contains('button', 'next').click();

            cy.get('input[role="combobox"').click();
            cy.contains('li', 'Scopus').click();
        });

        it('should show the resolve duplicates page', () => {
            cy.get('label[role="button"]').selectFile(
                'cypress/fixtures/standardFiles/onenoteStudiesDuplicates.txt'
            );
            cy.contains('button', 'next').click();
            cy.contains('Duplicates were found in your import file').should('be.visible');
            cy.contains('button', 'next').should('be.disabled');
        });

        it('should resolve all cases', () => {
            cy.get('label[role="button"]').selectFile(
                'cypress/fixtures/standardFiles/onenoteStudiesDuplicates.txt'
            );
            cy.contains('button', 'next').click();
            cy.contains('button', 'Keep this study').first().click();
            cy.contains('button', 'next').should('not.be.disabled');
        });

        it('should mark one case as duplicate', () => {
            cy.get('label[role="button"]').selectFile(
                'cypress/fixtures/standardFiles/onenoteStudiesDuplicates.txt'
            );
            cy.contains('button', 'next').click();
            cy.contains('button', 'This is a duplicate').first().click();
            cy.contains('button', 'next').should('be.disabled');
        });
    });

    describe('PROJECT DUPLICATES', () => {
        beforeEach(() => {
            cy.intercept('GET', `**/api/projects/*`, {
                fixture: 'projects/projectWithStub',
            }).as('projectFixture');
            // not a very good mocked update, but we need to provide a fixture so that it doesnt send a real request to the BE
            cy.intercept('PUT', '**/api/projects/**', { fixture: 'projects/projectWithStub' }).as(
                'updateProjectFixture'
            );
            cy.login('mocked')
                .visit('/projects/abc123/curation')
                .wait('@projectFixture')
                .wait('@studysetFixture');
            cy.contains('button', 'import studies').click();
            cy.contains('Import via File Format').click();
            cy.contains('button', 'next').click();

            cy.get('input[role="combobox"').click();
            cy.contains('li', 'Scopus').click();
        });

        it('should show the resolve duplicates page if there are duplicates IN THE PROJECT', () => {
            cy.get('label[role="button"]').selectFile(
                'cypress/fixtures/standardFiles/onenoteStudies.txt'
            );

            cy.contains('button', 'next').click();
            cy.get('input').type('my new import{enter}');
            cy.contains('button', 'next').click();
            cy.contains(/duplicates that already exist within the project/).should('be.visible');
            cy.contains('button', 'next').should('be.disabled');
        });

        it('should resolve all cases', () => {
            cy.get('label[role="button"]').selectFile(
                'cypress/fixtures/standardFiles/onenoteStudies.txt'
            );

            cy.contains('button', 'next').click();
            cy.get('input').type('my new import{enter}');
            cy.contains('button', 'next').click();
            cy.contains('button', 'Keep this study').first().click();
            cy.contains('button', 'next').should('be.enabled');
        });
    });

    describe('Other features', () => {
        beforeEach(() => {
            cy.intercept('GET', '**/api/base-studies/**', {
                fixture: 'baseStudies/baseStudiesWithResults',
            }).as('baseStudiesFixture');
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            cy.login('mocked')
                .visit('/projects/abc123/curation')
                .wait('@projectFixture')
                .wait('@studysetFixture');
            cy.contains('button', 'import studies').click();
            cy.contains('button', 'next').click();
        });

        it('should select the import by clicking the option', () => {
            cy.wait('@baseStudiesFixture').then((baseStudiesResponse) => {
                cy.contains(
                    'button',
                    `Import ${baseStudiesResponse.response?.body?.results?.length} studies from neurostore`
                ).click();
            });
            cy.get('input').type('my new import');
            cy.contains('Set name as "my new import"').click();
            cy.contains('button', 'next').should('not.be.disabled');
        });

        it('should select the import by pressing enter', () => {
            cy.wait('@baseStudiesFixture').then((baseStudiesResponse) => {
                cy.contains(
                    'button',
                    `Import ${baseStudiesResponse.response?.body?.results?.length} studies from neurostore`
                ).click();
            });
            cy.get('input').type('my new import{enter}');
            cy.contains('button', 'next').should('not.be.disabled');
        });
    });
});
