import { render, screen } from '@testing-library/react';
import StateHandlerComponent from './StateHandlerComponent';

describe('StateHandlerComponent', () => {
    it('should render', () => {
        render(
            <StateHandlerComponent
                loadingText="some-loading-text"
                errorMessage="some-error-text"
                isLoading={false}
                isError={false}
            >
                <span>some-child-text</span>
            </StateHandlerComponent>
        );
    });

    it('should load', () => {
        render(
            <StateHandlerComponent
                loadingText="some-loading-text"
                errorMessage="some-error-text"
                isLoading={true}
                isError={false}
            >
                <span>some-child-text</span>
            </StateHandlerComponent>
        );
        expect(screen.queryByText('some-error-text')).not.toBeInTheDocument();
        expect(screen.queryByText('some-child-text')).not.toBeInTheDocument();
        expect(screen.queryByText('some-loading-text')).toBeInTheDocument();
    });

    it('should show an error', () => {
        render(
            <StateHandlerComponent
                loadingText="some-loading-text"
                errorMessage="some-error-text"
                isLoading={false}
                isError={true}
            >
                <span>some-child-text</span>
            </StateHandlerComponent>
        );
        expect(screen.queryByText('some-error-text')).toBeInTheDocument();
        expect(screen.queryByText('some-child-text')).not.toBeInTheDocument();
        expect(screen.queryByText('some-loading-text')).not.toBeInTheDocument();
    });

    it('should show children', () => {
        render(
            <StateHandlerComponent
                loadingText="some-loading-text"
                errorMessage="some-error-text"
                isLoading={false}
                isError={false}
            >
                <span>some-child-text</span>
            </StateHandlerComponent>
        );
        expect(screen.queryByText('some-error-text')).not.toBeInTheDocument();
        expect(screen.queryByText('some-child-text')).toBeInTheDocument();
        expect(screen.queryByText('some-loading-text')).not.toBeInTheDocument();
    });
});
