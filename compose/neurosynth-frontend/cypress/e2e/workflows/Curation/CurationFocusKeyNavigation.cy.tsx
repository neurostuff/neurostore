/// <reference types="cypress" />

const FIRST_STUDY_TITLE =
    'Spatial working memory in heavy cannabis users: a functional magnetic resonance imaging study.';
const SECOND_STUDY_TITLE =
    'Balanced modulation of striatal activation from D /D receptors in caudate and ventral striatum: Disruption in cannabis abusers.';
const THIRD_STUDY_TITLE =
    'An fMRI Study of Neuronal Activation in Schizophrenia Patients with and without Previous Cannabis Use';
const FOCUS_MODE_SEEN_KEY = 'auth0|62e0e6c9dd47048572613b4d-abc123-seen-curation-focus-mode';

const pressKey = (key: string) => {
    cy.window().then((win) => {
        win.dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    });
};

const expectFocusedStudy = (title: string) => {
    cy.contains('h6', title).should('be.visible');
    cy.get('.MuiListItemButton-root.Mui-selected')
        .filter((_, el) => el.innerText.includes(title))
        .should('have.length', 1);
};

const detailPane = () =>
    cy
        .contains('h6', FIRST_STUDY_TITLE)
        .parents()
        .filter((_, el) => {
            const overflowY = getComputedStyle(el).overflowY;
            return overflowY === 'auto' || overflowY === 'scroll';
        })
        .first();

const accordionSummary = (label: string) =>
    cy.get('.MuiAccordionSummary-root').filter((_, el) => (el.textContent || '').includes(label));

const buttonByText = (text: string) => cy.get('button').filter((_, el) => (el.textContent || '').includes(text));

const openIdentificationFocus = () => {
    cy.contains('button', 'Manually review').click();
    cy.get('tr').eq(1).click({ force: true });
    cy.contains('button', 'back to table view').should('exist');
    expectFocusedStudy(FIRST_STUDY_TITLE);
};

const expectSettledScrollTop = (check: (scrollTop: number) => void) => {
    let previous: number | undefined;
    detailPane().should(($el) => {
        const scrollTop = $el[0].scrollTop;
        const settled = previous === scrollTop;
        previous = scrollTop;
        expect(settled).to.equal(true);
        check(scrollTop);
    });
};

describe('Curation focus key navigation', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://api.appzi.io/**', { fixture: 'appzi' }).as('appziFixture');

        cy.addToLocalStorage('auth0|62e0e6c9dd47048572613b4d-hide-info-popup', 'true');
        cy.addToLocalStorage('-hide-info-popup', 'true');
        cy.addToLocalStorage('show-new-ui-may-30-2025', 'true');

        cy.intercept('POST', `**/api/pipeline-study-results/?feature_display=TaskExtractor*`, {
            fixture: 'Curation/CurationFocusKeyNavigation/taskExtraction',
        }).as('taskExtraction');
        cy.intercept('POST', `**/api/pipeline-study-results/?feature_display=ParticipantDemographicsExtractor*`, {
            fixture: 'Curation/CurationFocusKeyNavigation/participantDemographicsExtraction',
        }).as('participantDemographicsExtraction');

        cy.fixture('Curation/CurationFocusKeyNavigation/project').then((projectFixture) => {
            // Route param is abc123. Matching the payload id keeps a later refetch from reloading the fixture
            // and wiping promote/demote changes made in the curation store.
            const project = Cypress._.cloneDeep(projectFixture);
            cy.intercept('GET', `**/api/projects/*`, (req) => {
                req.reply(project);
            }).as('projectFixture');
            cy.intercept('PUT', `**/api/projects/*`, (req) => {
                Object.assign(project, req.body, {
                    id: 'abc123',
                    updated_at: project.updated_at,
                    created_at: project.created_at,
                });
                req.reply(project);
            }).as('updateProject');

            cy.login('mocked').visit('/projects/abc123/curation').wait('@projectFixture');
            cy.wait('@taskExtraction');
            cy.wait('@participantDemographicsExtraction');
        });
    });

    describe('shortcuts popup', () => {
        it('shows the shortcuts the first time focus mode opens', () => {
            openIdentificationFocus();
            cy.contains('Focus mode shortcuts').should('be.visible');
            cy.contains('button', 'Understood').should('be.visible');
        });

        it('stays closed when this user has already seen focus mode for the project', () => {
            cy.addToLocalStorage(FOCUS_MODE_SEEN_KEY, 'true');
            openIdentificationFocus();
            cy.contains('Focus mode shortcuts').should('not.exist');
        });
    });

    describe('keyboard shortcuts', () => {
        beforeEach(() => {
            cy.addToLocalStorage(FOCUS_MODE_SEEN_KEY, 'true');
            openIdentificationFocus();
            cy.contains('Focus mode shortcuts').should('not.exist');
        });

        it('selects the next and previous study with arrow down and up', () => {
            pressKey('ArrowUp');
            expectFocusedStudy(FIRST_STUDY_TITLE);

            pressKey('ArrowDown');
            expectFocusedStudy(SECOND_STUDY_TITLE);

            pressKey('ArrowDown');
            expectFocusedStudy(THIRD_STUDY_TITLE);

            pressKey('ArrowUp');
            expectFocusedStudy(SECOND_STUDY_TITLE);
        });

        it('scrolls the detail pane down and up with arrow right and left', () => {
            detailPane().should(($el) => {
                expect($el[0].scrollHeight).to.be.greaterThan($el[0].clientHeight);
            });

            pressKey('ArrowRight');
            expectSettledScrollTop((scrollTop) => {
                expect(scrollTop).to.be.greaterThan(0);
            });

            detailPane()
                .invoke('scrollTop')
                .then((scrolledDown) => {
                    pressKey('ArrowLeft');
                    expectSettledScrollTop((scrollTop) => {
                        expect(scrollTop).to.be.lessThan(scrolledDown);
                    });
                });
        });

        it('promotes the focused study with a and moves to the next study', () => {
            pressKey('a');
            expectFocusedStudy(SECOND_STUDY_TITLE);
            cy.contains('.MuiListItemButton-root', FIRST_STUDY_TITLE).should('not.exist');

            cy.contains('li', '2. Screening').click();
            cy.contains('tr', FIRST_STUDY_TITLE).click({ force: true });
            expectFocusedStudy(FIRST_STUDY_TITLE);
        });

        it('excludes the focused study with s and moves to the next study', () => {
            pressKey('s');
            expectFocusedStudy(SECOND_STUDY_TITLE);
            cy.contains('.MuiListItemButton-root', FIRST_STUDY_TITLE).should('contain', 'Duplicate');

            pressKey('ArrowUp');
            expectFocusedStudy(FIRST_STUDY_TITLE);
            cy.contains('.MuiChip-root', 'Duplicate').should('be.visible');
        });

        it('demotes the focused study with d and moves to the next study', () => {
            pressKey('a');
            expectFocusedStudy(SECOND_STUDY_TITLE);
            pressKey('a');
            expectFocusedStudy(THIRD_STUDY_TITLE);

            cy.contains('li', '2. Screening').click();
            cy.contains('tr', SECOND_STUDY_TITLE).click({ force: true });
            expectFocusedStudy(SECOND_STUDY_TITLE);

            pressKey('d');
            expectFocusedStudy(FIRST_STUDY_TITLE);
            cy.contains('.MuiListItemButton-root', SECOND_STUDY_TITLE).should('not.exist');

            cy.contains('li', '1. Identification').click();
            cy.contains('button', 'Manually review').click();
            cy.contains('tr', SECOND_STUDY_TITLE).should('exist');
        });

        it('expands and contracts the abstract and extraction sections with e', () => {
            accordionSummary('Experimental Details').scrollIntoView().should('have.attr', 'aria-expanded', 'true');
            accordionSummary('Participant Demographics').should('have.attr', 'aria-expanded', 'true');
            buttonByText('Read less').should('exist');

            pressKey('e');

            accordionSummary('Experimental Details').should('have.attr', 'aria-expanded', 'false');
            accordionSummary('Participant Demographics').should('have.attr', 'aria-expanded', 'false');
            buttonByText('Read more').should('exist');

            pressKey('e');

            accordionSummary('Experimental Details').should('have.attr', 'aria-expanded', 'true');
            accordionSummary('Participant Demographics').should('have.attr', 'aria-expanded', 'true');
            buttonByText('Read less').should('exist');
        });
    });
});
