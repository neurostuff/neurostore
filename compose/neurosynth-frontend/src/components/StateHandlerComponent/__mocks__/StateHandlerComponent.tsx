import type { ReactNode } from 'react';
import { IStateHandlerComponent } from '../StateHandlerComponent';

const mockStateHandlerComponent = (props: IStateHandlerComponent) => {
    if (props.isError) {
        return <div data-testid="state-handler-component-error">{props.errorMessage || 'there is an error'}</div>;
    }

    if (props.isLoading) {
        return <div data-testid="state-handler-component-loading">{props.loadingText || 'loading'}</div>;
    }

    return <>{props.children}</>;
};

export default mockStateHandlerComponent;
