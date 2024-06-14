/// <reference types="cypress" />

const PATH = '/projects/new/sleuth';

describe('DoSleuthImport', () => {
    beforeEach(() => {
        cy.clearLocalStorage().clearSessionStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/meta-analyses*`, { fixture: 'metaAnalyses' }).as(
            'metaAnalysesFixture'
        );
    });

    it('should load successfully', () => {
        cy.login('mocked').visit(PATH);
    });

    describe('should upload invalid sleuth files', () => {
        beforeEach(() => {
            cy.login('mocked').visit(PATH);
            cy.contains('button', 'next').click();
        });

        it('should upload a file and show invalid with no reference', () => {
            cy.get('input[type="file"]').selectFile(
                'cypress/fixtures/sleuthFiles/invalidSleuthFileNoReference.txt',
                { force: true }
            );
            cy.contains('No coordinate reference');
        });
    });
});
