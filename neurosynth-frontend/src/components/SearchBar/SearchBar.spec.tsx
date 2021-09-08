import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';

import { mount } from "@cypress/react"
import SearchBar, { SearchBarModel } from "./SearchBar"

import { expect } from 'chai'

chai.use(sinonChai.default);

describe("SearchBar Component", () => {
    it("should render", () => {
        const onSearchMock = () => { }
        mount(<SearchBar onSearch={onSearchMock} />)
        cy.get("[data-cy=search-form]").should('exist').and('be.visible')
        cy.get("[data-cy=search-input]").should('exist').and('be.visible')
        cy.get("[data-cy=search-icon]").should('exist').and('be.visible')
    })

    it('should enter a value and invoke onSearch', () => {
        const searchedString = "searched string"
        const mockProps: SearchBarModel = {
            onSearch: () => {
                console.log("hello");
            }
        };
        const onSearchSpy = cy.spy(mockProps, "onSearch")
        mount(<SearchBar onSearch={mockProps.onSearch} />)

        // expects element to be in a typable state
        cy.get("[data-cy=search-input] .MuiInputBase-input").type(searchedString).should('have.value', searchedString);
        // // expects element to be in an actionable state
        cy.get("[data-cy=search-icon]").click().then(() => {
            expect(onSearchSpy).to.have.been.called;
        })
    })
})