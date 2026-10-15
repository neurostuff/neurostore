import { renderHook } from '@testing-library/react';
import { useOpClient } from './context';

describe('useOpClient', () => {
    it('throws without an OpClientProvider, as its sibling hooks do', () => {
        expect(() => renderHook(() => useOpClient())).toThrow('useOpClient needs an OpClientProvider');
    });
});
