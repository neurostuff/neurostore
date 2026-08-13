/// <reference types="cypress" />

export {};

const BASE_STUDY_ID = 'mock-base-study-id';
const PATH = `/base-studies/${BASE_STUDY_ID}`;
const PAGE_NAME = 'BaseStudyPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
        cy.intercept('GET', `**/api/base-studies/${BASE_STUDY_ID}*`, {
            fixture: 'baseStudyWithTypedVersions',
        }).as('baseStudyFixture');
        cy.intercept('GET', '**/api/studies/image-version-id*', {
            fixture: 'studyVersionImage',
        }).as('imageStudyFixture');
        cy.intercept('GET', '**/api/studies/coord-version-id*', {
            fixture: 'studyVersionCoordinate',
        }).as('coordStudyFixture');
    });

    it('defaults to the latest version and shows type then version chips without a toggle', () => {
        cy.visit(PATH);
        cy.wait('@baseStudyFixture');
        cy.wait('@imageStudyFixture');

        cy.url().should('include', `/base-studies/${BASE_STUDY_ID}/image-version-id`);
        cy.get('[data-testid="study-type-chip"]').should('contain.text', 'Images');
        cy.get('[data-testid="study-version-chip"]').should('contain.text', 'Version: image-version-id');
        cy.contains('button', 'CBMA').should('not.exist');
        cy.contains('button', 'IBMA').should('not.exist');
        cy.contains('label', 'Select version to view').should('exist');
    });

    it('selects the latest coordinate version when type=coordinate is present', () => {
        cy.visit(`${PATH}?type=coordinate`);
        cy.wait('@baseStudyFixture');
        cy.wait('@coordStudyFixture');

        cy.url().should('include', `/base-studies/${BASE_STUDY_ID}/coord-version-id`);
        cy.url().should('include', 'type=coordinate');
        cy.get('[data-testid="study-type-chip"]').should('contain.text', 'Coordinates');
        cy.get('[data-testid="study-version-chip"]').should('contain.text', 'Version: coord-version-id');
    });

    it('selects the latest image version when type=image is present', () => {
        cy.visit(`${PATH}?type=image`);
        cy.wait('@baseStudyFixture');
        cy.wait('@imageStudyFixture');

        cy.url().should('include', `/base-studies/${BASE_STUDY_ID}/image-version-id`);
        cy.get('[data-testid="study-type-chip"]').should('contain.text', 'Images');
    });

    it('shows type prominently in the version dropdown options', () => {
        cy.visit(`${PATH}/image-version-id`);
        cy.wait('@baseStudyFixture');
        cy.wait('@imageStudyFixture');

        cy.contains('label', 'Select version to view').parent().click();
        cy.get('[role="listbox"]').within(() => {
            cy.contains('Images').should('exist');
            cy.contains('Coordinates').should('exist');
            cy.contains('Owner: image-owner').should('exist');
            cy.contains('Owner: coord-owner').should('exist');
        });
    });
});
