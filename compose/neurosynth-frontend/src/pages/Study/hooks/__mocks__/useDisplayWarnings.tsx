import { vi } from 'vitest';

const useDisplayWarnings = vi.fn().mockReturnValue({
    hasDuplicateName: false,
    hasNoName: false,
    hasNoPoints: false,
    hasNonMNICoordinates: false,
});

export default useDisplayWarnings;
