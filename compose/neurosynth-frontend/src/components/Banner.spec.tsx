import { fireEvent, render, screen } from '@testing-library/react';
import { useQuery } from 'react-query';
import { Mock, vi } from 'vitest';
import Banner from './Banner';

vi.mock('react-query');

const createMockBanner = (overrides = {}) => ({
    id: '1',
    active: true,
    description: 'Test banner description',
    displayStartDate: '2020-01-01',
    displayEndDate: '2099-12-31',
    linkText: 'Click here',
    linkURI: 'https://example.com',
    bannerColor: 'primary.dark',
    ...overrides,
});

describe('Banner Component', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.clearAllMocks();
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should render a banner when display is true and within date range', () => {
        const mockBanner = createMockBanner();
        (useQuery as Mock).mockReturnValue({
            data: [mockBanner],
            isLoading: false,
            isError: false,
        });

        render(<Banner />);

        expect(screen.getByText('Test banner description')).toBeInTheDocument();
        expect(screen.getByText('Click here')).toBeInTheDocument();
    });

    it('should not render a banner when display is false', () => {
        const mockBanner = createMockBanner({ active: false });
        (useQuery as Mock).mockReturnValue({
            data: [mockBanner],
            isLoading: false,
            isError: false,
        });

        render(<Banner />);

        expect(screen.queryByText('Test banner description')).not.toBeInTheDocument();
    });

    it('should not render a banner when current date is before displayStartDate', () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        const mockBanner = createMockBanner({
            displayStartDate: futureDate.toISOString().split('T')[0],
            displayEndDate: '2099-12-31',
        });
        (useQuery as Mock).mockReturnValue({
            data: [mockBanner],
            isLoading: false,
            isError: false,
        });

        render(<Banner />);

        expect(screen.queryByText('Test banner description')).not.toBeInTheDocument();
    });

    it('should not render a banner when current date is after displayEndDate', () => {
        const mockBanner = createMockBanner({
            displayStartDate: '2020-01-01',
            displayEndDate: '2020-12-31',
        });
        (useQuery as Mock).mockReturnValue({
            data: [mockBanner],
            isLoading: false,
            isError: false,
        });

        render(<Banner />);

        expect(screen.queryByText('Test banner description')).not.toBeInTheDocument();
    });

    it('should dismiss banner when close button is clicked and set localStorage', () => {
        const mockBanner = createMockBanner();
        (useQuery as Mock).mockReturnValue({
            data: [mockBanner],
            isLoading: false,
            isError: false,
        });

        render(<Banner />);

        expect(screen.getByText('Test banner description')).toBeInTheDocument();

        const closeButton = screen.getByRole('button');
        fireEvent.click(closeButton);

        expect(screen.queryByText('Test banner description')).not.toBeInTheDocument();
        expect(localStorage.getItem('CLOSE_BANNER_1')).toBe('true');
    });

    it('should not render banner if it was previously dismissed (localStorage key exists)', () => {
        localStorage.setItem('CLOSE_BANNER_1', 'true');

        const mockBanner = createMockBanner();
        (useQuery as Mock).mockReturnValue({
            data: [mockBanner],
            isLoading: false,
            isError: false,
        });

        render(<Banner />);

        expect(screen.queryByText('Test banner description')).not.toBeInTheDocument();
    });

    it('should render multiple banners when all meet criteria', () => {
        const mockBanners = [
            createMockBanner({ id: '1', description: 'Banner 1' }),
            createMockBanner({ id: '2', description: 'Banner 2' }),
        ];
        (useQuery as Mock).mockReturnValue({
            data: mockBanners,
            isLoading: false,
            isError: false,
        });

        render(<Banner />);

        expect(screen.getByText('Banner 1')).toBeInTheDocument();
        expect(screen.getByText('Banner 2')).toBeInTheDocument();
    });

    it('should only dismiss the specific banner when close is clicked', () => {
        const mockBanners = [
            createMockBanner({ id: '1', description: 'Banner 1' }),
            createMockBanner({ id: '2', description: 'Banner 2' }),
        ];
        (useQuery as Mock).mockReturnValue({
            data: mockBanners,
            isLoading: false,
            isError: false,
        });

        render(<Banner />);

        expect(screen.getByText('Banner 1')).toBeInTheDocument();
        expect(screen.getByText('Banner 2')).toBeInTheDocument();

        const closeButtons = screen.getAllByRole('button');
        fireEvent.click(closeButtons[0]);

        expect(screen.queryByText('Banner 1')).not.toBeInTheDocument();
        expect(screen.getByText('Banner 2')).toBeInTheDocument();
        expect(localStorage.getItem('CLOSE_BANNER_1')).toBe('true');
        expect(localStorage.getItem('CLOSE_BANNER_2')).toBeNull();
    });

    it('should filter out banners that do not meet all criteria from multiple banners', () => {
        const mockBanners = [
            createMockBanner({ id: '1', description: 'Visible Banner' }),
            createMockBanner({ id: '2', description: 'Hidden - Display False', active: false }),
            createMockBanner({
                id: '3',
                description: 'Hidden - Past Date',
                displayEndDate: '2020-01-01',
            }),
        ];
        (useQuery as Mock).mockReturnValue({
            data: mockBanners,
            isLoading: false,
            isError: false,
        });

        render(<Banner />);

        expect(screen.getByText('Visible Banner')).toBeInTheDocument();
        expect(screen.queryByText('Hidden - Display False')).not.toBeInTheDocument();
        expect(screen.queryByText('Hidden - Past Date')).not.toBeInTheDocument();
    });

    it('should render nothing when data is undefined', () => {
        (useQuery as Mock).mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: false,
        });

        const { container } = render(<Banner />);

        // Component returns empty fragment when no visible banners
        expect(container.firstChild).toBeNull();
    });

    it('should render nothing when data is an empty array', () => {
        (useQuery as Mock).mockReturnValue({
            data: [],
            isLoading: false,
            isError: false,
        });

        const { container } = render(<Banner />);

        // Component returns empty fragment when no visible banners
        expect(container.firstChild).toBeNull();
    });

    it('should render the correct link href from banner config', () => {
        const mockBanner = createMockBanner({
            linkURI: 'https://custom-link.com',
            linkText: 'Custom Link',
        });
        (useQuery as Mock).mockReturnValue({
            data: [mockBanner],
            isLoading: false,
            isError: false,
        });

        render(<Banner />);

        const link = screen.getByText('Custom Link');
        expect(link).toHaveAttribute('href', 'https://custom-link.com');
        expect(link).toHaveAttribute('target', '_blank');
    });

    it('should show banner on exact start date', () => {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const mockBanner = createMockBanner({
            displayStartDate: today,
            displayEndDate: '2099-12-31',
        });
        (useQuery as Mock).mockReturnValue({
            data: [mockBanner],
            isLoading: false,
            isError: false,
        });

        render(<Banner />);

        expect(screen.getByText('Test banner description')).toBeInTheDocument();
    });

    it('should show banner on exact end date', () => {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const mockBanner = createMockBanner({
            displayStartDate: '2020-01-01',
            displayEndDate: today,
        });
        (useQuery as Mock).mockReturnValue({
            data: [mockBanner],
            isLoading: false,
            isError: false,
        });

        render(<Banner />);

        expect(screen.getByText('Test banner description')).toBeInTheDocument();
    });
});
