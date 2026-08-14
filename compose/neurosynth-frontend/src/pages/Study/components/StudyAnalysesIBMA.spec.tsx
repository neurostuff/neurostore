import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudyAnalysesIBMA from 'pages/Study/components/StudyAnalysesIBMA';
import { IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import { vi } from 'vitest';

vi.mock('pages/StudyIBMA/components/BrainMapDetailPanel');

const analysesWithImages = [
    {
        id: 'analysis-1',
        name: 'Face processing',
        description: 'Main contrast',
        order: 1,
        isNew: false,
        conditions: [],
        points: [],
        pointSpace: undefined,
        pointStatistic: undefined,
        images: [
            {
                id: 'image-1',
                filename: 'face_z.nii.gz',
                value_type: 'Z',
                url: 'https://example.com/face_z.nii.gz',
            },
            {
                id: 'image-2',
                filename: 'face_t.nii.gz',
                value_type: 'T',
                url: 'https://example.com/face_t.nii.gz',
            },
        ],
    },
    {
        id: 'analysis-2',
        name: 'Place processing',
        description: 'Secondary contrast',
        order: 2,
        isNew: false,
        conditions: [],
        points: [],
        pointSpace: undefined,
        pointStatistic: undefined,
        images: [
            {
                id: 'image-3',
                filename: 'place_z.nii.gz',
                value_type: 'Z',
                url: 'https://example.com/place_z.nii.gz',
            },
        ],
    },
] as IStoreAnalysis[];

describe('StudyAnalysesIBMA', () => {
    it('selects the first sorted image by default and shows it in the detail panel', () => {
        render(<StudyAnalysesIBMA id="study-1" analyses={analysesWithImages} />);

        // Images are sorted by filename, so face_t comes before face_z.
        expect(screen.getByTestId('mock-brain-map-detail-panel')).toHaveAttribute('data-image-id', 'image-2');
        expect(screen.getByText('face_t.nii.gz').closest('div[role="button"]')).toHaveClass('Mui-selected');
    });

    it('shows the selected image in the detail panel when an image is clicked', async () => {
        const user = userEvent.setup();
        render(<StudyAnalysesIBMA id="study-1" analyses={analysesWithImages} />);

        await user.click(screen.getByText('place_z.nii.gz'));

        expect(screen.getByTestId('mock-brain-map-detail-panel')).toHaveAttribute('data-image-id', 'image-3');
    });

    it('filters images across analyses by search query', async () => {
        const user = userEvent.setup();
        render(<StudyAnalysesIBMA id="study-1" analyses={analysesWithImages} />);

        await user.type(screen.getByTestId('study-analyses-ibma-search'), 'place');

        const list = screen.getByTestId('study-analyses-ibma-list');
        expect(within(list).getByText('place_z.nii.gz')).toBeInTheDocument();
        expect(within(list).queryByText('face_z.nii.gz')).not.toBeInTheDocument();
        expect(within(list).queryByText('face_t.nii.gz')).not.toBeInTheDocument();
    });

    it('collapses and expands an analysis image list', async () => {
        const user = userEvent.setup();
        render(<StudyAnalysesIBMA id="study-1" analyses={analysesWithImages} />);

        expect(screen.getByText('face_z.nii.gz')).toBeInTheDocument();

        await user.click(screen.getByText('Face processing'));
        expect(screen.queryByText('face_z.nii.gz')).not.toBeInTheDocument();

        await user.click(screen.getByText('Face processing'));
        expect(screen.getByText('face_z.nii.gz')).toBeInTheDocument();
    });

    it('shows an empty message when the study has no images', () => {
        render(
            <StudyAnalysesIBMA
                id="study-1"
                analyses={[
                    {
                        id: 'analysis-empty',
                        name: 'Empty',
                        isNew: false,
                        conditions: [],
                        points: [],
                        pointSpace: undefined,
                        pointStatistic: undefined,
                        images: [],
                    } as IStoreAnalysis,
                ]}
            />
        );

        expect(screen.getByText('There are no images for this study.')).toBeInTheDocument();
    });
});
