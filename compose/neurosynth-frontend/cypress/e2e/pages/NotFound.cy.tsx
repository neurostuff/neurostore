export {};

describe('NotFoundPage', () => {
    it('should display not found when the page is not found', () => {
        cy.visit('/page-that-doesnt-exist');
        cy.contains('Page not found');
    });
});
