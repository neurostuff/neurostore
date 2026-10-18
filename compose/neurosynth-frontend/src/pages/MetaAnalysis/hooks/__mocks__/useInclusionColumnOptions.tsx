import { vi } from 'vitest';

const useInclusionColumnOptions = vi.fn(
    (_annotationId?: string, _selectedKey?: string): Record<string, number> => ({
        'val-1': 1,
        'val-2': 1,
        'val-3': 1,
    })
);

export default useInclusionColumnOptions;
