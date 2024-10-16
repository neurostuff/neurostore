import { render } from '@testing-library/react';
import useSaveStudy from './useSaveStudy';

// Using a dummy component in order to test a custom hook
const DummyComponent = () => {
    const { isLoading, hasEdits, handleSave } = useSaveStudy();
    return (
        <div>
            <div data-testid="save-study-is-loading">{isLoading}</div>
            <div data-testid="save-study-has-edits">{hasEdits}</div>
            <button data-testid="save-study-button" onClick={handleSave}></button>
        </div>
    );
};

describe('useSaveStudy hook', () => {
    it('should work', () => {
        render(<DummyComponent />);
        expect(true).toBeFalsy();
    });
});
