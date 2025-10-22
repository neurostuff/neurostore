describe('HelpPage', () => {
    beforeEach(() => {
        cy.visit('/help');
    });

    it('should display Community Support section', () => {
        cy.contains('Community Support').should('be.visible');
    });

    it('should display Email Support section', () => {
        cy.contains('Email Support').should('be.visible');
    });

    it('should have Visit NeuroStars button with correct link', () => {
        cy.contains('a', 'Visit NeuroStars')
            .should('be.visible')
            .and('have.attr', 'href', 'https://neurostars.org/tag/neurosynth-compose')
            .and('have.attr', 'target', '_blank')
            .and('have.attr', 'rel', 'noopener noreferrer');
    });

    it('should have Send Email button with correct mailto link', () => {
        cy.contains('a', 'Send Email')
            .should('be.visible')
            .and('have.attr', 'href', 'mailto:neurosynthorg@gmail.com')
            .and('have.attr', 'target', '_blank')
            .and('have.attr', 'rel', 'noopener noreferrer');
    });

    it('should display the email address link in Email Support section', () => {
        cy.contains('a', 'neurosynthorg@gmail.com')
            .should('be.visible')
            .and('have.attr', 'href', 'mailto:neurosynthorg@gmail.com');
    });

    it('should display documentation link in tip section', () => {
        cy.contains('a', 'documentation')
            .should('be.visible')
            .and('have.attr', 'href', 'https://neurostuff.github.io/compose-docs/')
            .and('have.attr', 'target', '_blank');
    });
});
