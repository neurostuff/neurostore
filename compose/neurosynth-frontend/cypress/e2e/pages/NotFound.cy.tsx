export {};

describe('NotFoundPage', () => {
    beforeEach(() => {
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');
    });

    it('should display not found when the page is not found', () => {
        cy.visit('/page-that-doesnt-exist');
        cy.contains('Requested resource not found');
    });

    // it('should route the non existent studyset resource to the not found page', () => {
    //     cy.intercept('GET', '**/api/studysets/*', { statusCode: 404 }).as('studysetsRequestError');
    //     cy.intercept('GET', '**/api/annotations/*', { statusCode: 404 }).as(
    //         'annotationsRequestError'
    //     );

    //     cy.visit('/studysets/studyset-that-doesnt-exist')
    //         .wait(['@studysetsRequestError', '@annotationsRequestError'])
    //         .get('body')
    //         .contains('Requested resource not found');
    // });

    // it('should route the non existent meta-analysis resource to the not found page', () => {
    //     cy.intercept('GET', '**/api/meta-analyses/**', { statusCode: 404 }).as(
    //         'metaAnalysisRequestError'
    //     );

    //     cy.visit('/meta-analyses/meta-analysis-that-doesnt-exist')
    //         .wait(['@metaAnalysisRequestError'])
    //         .get('body')
    //         .contains('Requested resource not found');
    // });

    // it('should route the non existent annotation resource to the not found page', () => {
    //     cy.intercept('GET', '**/api/annotations/*', {
    //         statusCode: 404,
    //     }).as('annotationRequestError');

    //     cy.visit('/annotations/annotation-doesnt-exist')
    //         .wait(['@annotationRequestError'])
    //         .get('body')
    //         .contains('Requested resource not found');
    // });
});
