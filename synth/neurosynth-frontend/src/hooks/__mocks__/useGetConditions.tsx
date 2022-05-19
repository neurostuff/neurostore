import { mockConditions } from 'testing/mockData';

const mockUseGetConditions = jest.fn().mockReturnValue({
    isLoading: false,
    data: mockConditions(),
    isError: false,
});

export default mockUseGetConditions;
