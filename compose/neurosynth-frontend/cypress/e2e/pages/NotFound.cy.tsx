export {};

describe('NotFoundPage', () => {
    beforeEach(() => {
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
    });

    it('should display not found when the page is not found', () => {
        cy.visit('/page-that-doesnt-exist');
        cy.contains('Requested resource not found');
    });
});
