import { NavigateProps } from 'react-router-dom';

const useParams = jest.fn().mockReturnValue({
    projectId: 'test-project-id',
});

const useNavigate = jest.fn().mockReturnValue(jest.fn());

const useLocation = jest.fn().mockReturnValue({
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
