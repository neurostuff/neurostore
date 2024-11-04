import { vi } from 'vitest';
import { NavigateProps } from 'react-router-dom';

const useParams = vi.fn().mockReturnValue({
    projectId: 'test-project-id',
});

const useNavigate = vi.fn().mockReturnValue(vi.fn());

const useLocation = vi.fn().mockReturnValue({
    location: {
        search: '',
    },
});

const Navigate = ({ to, replace, state }: NavigateProps) => {
    return (
        <>
            <div data-testid="to">{to}</div>
            <div data-testid="replace">{replace}</div>
            <div data-testid="state">{JSON.stringify(state)}</div>
        </>
    );
};

export { useNavigate, useLocation, useParams, Navigate };
