import { mockStudy } from 'testing/mockData';

const mockUseGetStudyById = jest.fn().mockReturnValue({
    isLoading: false,
    data: mockStudy(),
});

export default mockUseGetStudyById;
