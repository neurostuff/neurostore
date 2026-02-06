/// <reference types="cypress" />

describe('ImportFileFormatDialog', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/projects/*`, {
            fixture: 'projects/projectExtractionStep',
        }).as('projectFixture');
        cy.intercept('GET', `**/api/studysets/*`, { fixture: 'studyset' }).as('studysetFixture');
    });

    describe('Import Bibliography', () => {
        beforeEach(() => {
            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture').wait('@studysetFixture');
            cy.intercept('PUT', '**/api/projects/abc123').as('updateProjectFixture');
            cy.contains('button', 'import studies').click();
            cy.contains('Import Bibliography').click();
            cy.contains('button', 'next').click();
        });

        it('should show the standard file import page', () => {
            cy.contains(/Start typing to add or create your own source/).should('be.visible');
        });

        it('should disable the next button initially', () => {
            cy.contains('button', 'next').should('be.disabled');
        });

        it('should set the source and show the input', () => {
            cy.get('input[role="combobox"]').click();
            cy.contains('li', 'Scopus').click();
            cy.get('textarea').should('be.visible');
            cy.contains(/Input is empty/).should('be.visible');
        });

        it('should set the sources and enable the next button', () => {
            cy.get('input[role="combobox"]').click();
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
            cy.get('input[role="combobox"]').click();
            cy.contains('li', 'Scopus').click();
            cy.get('textarea[placeholder="paste in valid endnote, bibtex, or RIS syntax"]').type('INVALID FORMAT');
            cy.contains(/Format is incorrect/).should('be.visible');
        });

        it('should import studies', () => {
            cy.get('input[role="combobox"]').click();
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
            cy.contains('button', 'next').click().url().should('include', '/projects/abc123/curation');
        });

        it('should upload a onenote (ENW) file', () => {
            cy.get('input[role="combobox"]').click();
            cy.contains('li', 'Scopus').click();
            cy.get('label[role="button"]').selectFile('cypress/fixtures/standardFiles/onenoteStudies.txt');
            cy.contains('button', 'next').should('be.visible');
        });

        it('should upload a .RIS file and import successfully', () => {
            cy.get('input[role="combobox"]').click();
            cy.contains('li', 'Scopus').click();
            cy.get('label[role="button"]').selectFile('cypress/fixtures/standardFiles/ris.ris');
            cy.contains('button', 'next').should('be.visible').and('not.be.disabled');
            cy.contains('button', 'next').click();
        });

        it('should handle the duplicates in an import file', () => {
            cy.get('input[role="combobox"]').click();
            cy.contains('li', 'Scopus').click();
            cy.get('label[role="button"]').selectFile('cypress/fixtures/standardFiles/duplicates.ris');
            cy.contains('button', 'next').should('be.visible').and('not.be.disabled');
            cy.contains('button', 'next').click();
            cy.contains('Click to view 1 imported studies').click();
            cy.contains('(2023). Manifold Learning for fMRI time-varying FC').should(
                // doing this to enforce strict equals
                ($el: JQuery<HTMLElement> | undefined) => {
                    if (!$el) throw new Error('Could not find element');
                    expect($el.text()).to.equal('(2023). Manifold Learning for fMRI time-varying FC');
                }
            );
            cy.contains(/^\bbioRxiv\b/).should('exist'); // \b is a word boundary which means there shouldnt be any other letters/words before and after
        });

        // TODO : create a test for importing bibtex file
        // it('should import studies via a file', () => {})
    });
});
