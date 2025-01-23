import { render, screen } from '@testing-library/react';
import DisplayMetaAnalysisResults from './DisplayMetaAnalysisResults';
import { Mock } from 'vitest';
import { INeurovault } from 'hooks/metaAnalyses/useGetNeurovaultImages';
import { useGetNeurovaultImages } from 'hooks';
import { mockMetaAnalysisReturn } from 'testing/mockData';
import { Specification } from 'neurosynth-compose-typescript-sdk';

vi.mock('hooks');
vi.mock('pages/MetaAnalysis/components/MetaAnalysisResultStatusAlert');
vi.mock('pages/MetaAnalysis/components/DisplayParsedNiMareFile');
vi.mock('components/Visualizer/NiiVueVisualizer');

const caseNonsenseValues: Partial<INeurovault>[] = [
    { id: 2, name: 'BNonsensicalValue' },
    { id: 3, name: 'ZAnotherNonsenseValue' },
    { id: 1, name: 'ArandomValue' },
];
const caseRandomOrderDataTypes: Partial<INeurovault>[] = [
    { id: 12, name: 'label_desc-ABC' },
    { id: 3, name: 'p_desc-ABC' },
    { id: 2, name: 't_desc-ABC' },
    { id: 11, name: 'sigma2_desc-ABC' },
    { id: 5, name: 'chi2_desc-ABC' },
    { id: 4, name: 'logp_desc-ABC' },
    { id: 8, name: 'est_desc-ABC' },
    { id: 10, name: 'tau2_desc-ABC' },
    { id: 1, name: 'z_desc-ABC' },
    { id: 6, name: 'prob_desc-ABC' },
    { id: 9, name: 'se_desc-ABC' },
    { id: 7, name: 'stat_desc-ABC' },
];
const caseSameKeyDifferentValues: Partial<INeurovault>[] = [
    { id: 2, name: 'z_desc-DEF' },
    { id: 3, name: 'z_desc-ZZZ' },
    { id: 1, name: 'z_desc-ABC' },
];
const caseVoxelAndCluster: Partial<INeurovault>[] = [
    { id: 2, name: 'z_desc-ABC_level-voxel' },
    { id: 1, name: 'z_desc-ABC_level-cluster' },
];

const caseMKDAChi2: Partial<INeurovault>[] = [
    { id: 1, name: 'z_desc-AAA' },
    { id: 2, name: 'z_desc-CCC' },
    { id: 3, name: 'z_desc-ZZZ' },
    { id: 4, name: 'z_desc-uniformityMass' },
    { id: 5, name: 'z_desc-associationMass' },
];

const caseNotZAlphabetical: Partial<INeurovault>[] = [
    { id: 2, name: 'p_desc-DEF' },
    { id: 1, name: 'p_desc-ABC' },
];

const caseMoreSegments: Partial<INeurovault>[] = [
    { id: 2, name: 'z_desc-association_level-voxel_corr-FDR_method-indep.nii.gz' },
    { id: 1, name: 'z_desc-association.nii.gz' },
];

describe('DisplayMetaAnalysisResults', () => {
    it('should render', () => {
        render(<DisplayMetaAnalysisResults metaAnalysis={undefined} />);
    });

    it('should show the correctly sorted list for nonsense values, sorting by alphabetical order', () => {
        (useGetNeurovaultImages as Mock).mockReturnValue({
            data: caseNonsenseValues,
            isLoading: false,
            isError: false,
        });

        render(<DisplayMetaAnalysisResults metaAnalysis={mockMetaAnalysisReturn()} />);
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toEqual(caseNonsenseValues.length);
        expect(buttons[0].textContent).toBe('ArandomValue');
        expect(buttons[1].textContent).toBe('BNonsensicalValue');
        expect(buttons[2].textContent).toBe('ZAnotherNonsenseValue');
    });

    it('should show the correctly sorted list for data types', () => {
        (useGetNeurovaultImages as Mock).mockReturnValue({
            data: caseRandomOrderDataTypes,
            isLoading: false,
            isError: false,
        });

        // Passing in a meta-analysis as an argument is not necessary as we mock the hook that provides the actual data
        render(<DisplayMetaAnalysisResults metaAnalysis={mockMetaAnalysisReturn()} />);
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toEqual(caseRandomOrderDataTypes.length);
        expect(buttons[0].textContent).toBe('z_desc-ABC');
        expect(buttons[1].textContent).toBe('t_desc-ABC');
        expect(buttons[2].textContent).toBe('p_desc-ABC');
        expect(buttons[3].textContent).toBe('logp_desc-ABC');
        expect(buttons[4].textContent).toBe('chi2_desc-ABC');
        expect(buttons[5].textContent).toBe('prob_desc-ABC');
        expect(buttons[6].textContent).toBe('stat_desc-ABC');
        expect(buttons[7].textContent).toBe('est_desc-ABC');
        expect(buttons[8].textContent).toBe('se_desc-ABC');
        expect(buttons[9].textContent).toBe('tau2_desc-ABC');
        expect(buttons[10].textContent).toBe('sigma2_desc-ABC');
        expect(buttons[11].textContent).toBe('label_desc-ABC');
    });

    it('should show the correctly sorted list for same key different values', () => {
        (useGetNeurovaultImages as Mock).mockReturnValue({
            data: caseSameKeyDifferentValues,
            isLoading: false,
            isError: false,
        });

        // Passing in a meta-analysis as an argument is not necessary as we mock the hook that provides the actual data
        render(<DisplayMetaAnalysisResults metaAnalysis={mockMetaAnalysisReturn()} />);
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toEqual(caseSameKeyDifferentValues.length);
        expect(buttons[0].textContent).toBe('z_desc-ABC');
        expect(buttons[1].textContent).toBe('z_desc-DEF');
        expect(buttons[2].textContent).toBe('z_desc-ZZZ');
    });

    it('should show the correctly sorted list and prioritize cluster and then voxel', () => {
        (useGetNeurovaultImages as Mock).mockReturnValue({
            data: caseVoxelAndCluster,
            isLoading: false,
            isError: false,
        });

        render(<DisplayMetaAnalysisResults metaAnalysis={mockMetaAnalysisReturn()} />);
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toEqual(caseVoxelAndCluster.length);
        expect(buttons[0].textContent).toBe('z_desc-ABC_level-cluster');
        expect(buttons[1].textContent).toBe('z_desc-ABC_level-voxel');
    });

    it('should show the correctly sorted list for MKDAChi2', () => {
        const mockMetaAnalysis = mockMetaAnalysisReturn();
        (mockMetaAnalysis.specification as Specification).estimator = { type: 'MKDAChi2' };

        (useGetNeurovaultImages as Mock).mockReturnValue({
            data: caseMKDAChi2,
            isLoading: false,
            isError: false,
        });

        render(<DisplayMetaAnalysisResults metaAnalysis={mockMetaAnalysis} />);
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toEqual(caseMKDAChi2.length);
        expect(buttons[0].textContent).toBe('z_desc-associationMass');
        expect(buttons[1].textContent).toBe('z_desc-uniformityMass');
        expect(buttons[2].textContent).toBe('z_desc-AAA');
        expect(buttons[3].textContent).toBe('z_desc-CCC');
        expect(buttons[4].textContent).toBe('z_desc-ZZZ');
    });

    it('should show the correctly sorted list for non z maps', () => {
        (useGetNeurovaultImages as Mock).mockReturnValue({
            data: caseNotZAlphabetical,
            isLoading: false,
            isError: false,
        });

        render(<DisplayMetaAnalysisResults metaAnalysis={mockMetaAnalysisReturn()} />);
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toEqual(caseNotZAlphabetical.length);
        expect(buttons[0].textContent).toBe('p_desc-ABC');
        expect(buttons[1].textContent).toBe('p_desc-DEF');
    });

    it('should show the correctly sorted list if one file name is larger than the other', () => {
        (useGetNeurovaultImages as Mock).mockReturnValue({
            data: caseMoreSegments,
            isLoading: false,
            isError: false,
        });

        render(<DisplayMetaAnalysisResults metaAnalysis={mockMetaAnalysisReturn()} />);
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toEqual(caseMoreSegments.length);
        expect(buttons[0].textContent).toBe('z_desc-association_level-voxel_corr-FDR_method-indep.nii.gz');
        expect(buttons[1].textContent).toBe('z_desc-association.nii.gz');
    });
});
