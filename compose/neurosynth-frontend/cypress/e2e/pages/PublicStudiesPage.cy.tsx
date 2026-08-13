/// <reference types="cypress" />

export {};

const PATH = '/base-studies';
const PAGE_NAME = 'StudiesPage';

describe(PAGE_NAME, () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
    });

    it('should load successfully', () => {
        cy.intercept('GET', `**/api/projects*`).as('realProjectsRequest');
        cy.intercept('GET', `**/api/base-studies/**`).as('realStudiesRequest');
        cy.visit(PATH);
    });

    describe('study type handoff', () => {
        beforeEach(() => {
            cy.intercept('GET', '**/api/base-studies/**', {
                fixture: 'baseStudies/baseStudiesWithResults',
            }).as('studiesRequest');
        });

        it('navigates with type=image when the image filter is active', () => {
            cy.visit(`${PATH}?dataType=image`);
            cy.wait('@studiesRequest');
            cy.contains('Hemispheric specialization').parents('tr').first().click();
            cy.url().should('include', '/base-studies/4JnokyihF8Ao');
            cy.url().should('include', 'type=image');
        });

        it('navigates with type=coordinate when the coordinate filter is active', () => {
            cy.visit(`${PATH}?dataType=coordinate`);
            cy.wait('@studiesRequest');
            cy.contains('Hemispheric specialization').parents('tr').first().click();
            cy.url().should('include', '/base-studies/4JnokyihF8Ao');
            cy.url().should('include', 'type=coordinate');
        });

        it('navigates without type when the All filter is active', () => {
            cy.visit(`${PATH}?dataType=all`);
            cy.wait('@studiesRequest');
            cy.contains('Hemispheric specialization').parents('tr').first().click();
            cy.url().should('include', '/base-studies/4JnokyihF8Ao');
            cy.url().should('not.include', 'type=');
        });
    });
});
