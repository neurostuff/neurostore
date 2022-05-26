import { act, render, screen } from '@testing-library/react';
import { StudysetsApiResponse, StudyApiResponse } from '../../utils/api';
import StudysetsPopupMenu from './StudysetsPopupMenu';
import userEvent from '@testing-library/user-event';

jest.mock('../NeurosynthPopper/NeurosynthPopper');
jest.mock('../NeurosynthLoader/NeurosynthLoader');

const mockStudy: StudyApiResponse = {
    analyses: ['5CgFrbqVsKsH', '4TType6JzACT', '3qgrMH6Etutw'],
    authors:
        "Robert M. Mok, M. Clare O'Donoguhue, Nicholas E. Myers, Erin H.S. Drazich and Anna C. Nobre",
    created_at: '2021-09-14T16:01:55.799028+00:00',
    description:
        "fMRI study: selective working memory in aging\r\n\r\nMok et al (2019), Neural markers of category-based selective working memory in aging. NeuroImage.\r\nAuthors: Robert M Mok, M. Clare O'Donoghue, Nicholas E Myers, Erin H.S. Drazich, Anna Christina Nobre \r\n\r\nPublished manuscript: https://www.sciencedirect.com/science/article/pii/S1053811919302228\r\n\r\nPreprint: https://www.biorxiv.org/content/early/2018/10/05/435388\r\ndoi: https://doi.org/10.1101/435388\r\n\r\n",
    doi: '10.1016/j.neuroimage.2019.03.033',
    id: '5LMdXPD3ocgD',
    metadata: {
        acquisition_orientation: '',
        add_date: '2019-01-16T18:02:09.525616Z',
        autocorrelation_model: '',
        b0_unwarping_software: '',
        communities: [],
        contributors: '',
        coordinate_space: null,
        doi_add_date: '2019-03-28T13:36:44.306669Z',
        download_url: 'https://neurovault.org/collections/4742/download',
        echo_time: null,
        field_of_view: null,
        field_strength: null,
        flip_angle: null,
        full_dataset_url: '',
        functional_coregistered_to_structural: null,
        functional_coregistration_method: '',
        group_comparison: null,
        group_description: '',
        group_estimation_type: '',
        group_inference_type: null,
        group_model_multilevel: '',
        group_model_type: '',
        group_modeling_software: '',
        group_repeated_measures: null,
        group_repeated_measures_method: '',
        handedness: null,
        hemodynamic_response_function: '',
        high_pass_filter_method: '',
        inclusion_exclusion_criteria: '',
        interpolation_method: '',
        intersubject_registration_software: '',
        intersubject_transformation_type: null,
        intrasubject_estimation_type: '',
        intrasubject_model_type: '',
        intrasubject_modeling_software: '',
        length_of_blocks: null,
        length_of_runs: null,
        length_of_trials: '',
        matrix_size: null,
        modify_date: '2019-04-23T18:18:07.556578Z',
        motion_correction_interpolation: '',
        motion_correction_metric: '',
        motion_correction_reference: '',
        motion_correction_software: '',
        nonlinear_transform_type: '',
        number_of_experimental_units: null,
        number_of_images: 8,
        number_of_imaging_runs: null,
        number_of_rejected_subjects: null,
        nutbrain_food_choice_type: '',
        nutbrain_food_viewing_conditions: '',
        nutbrain_hunger_state: null,
        nutbrain_odor_conditions: '',
        nutbrain_taste_conditions: '',
        object_image_type: '',
        optimization: null,
        optimization_method: '',
        order_of_acquisition: null,
        order_of_preprocessing_operations: '',
        orthogonalization_description: '',
        owner: 5059,
        owner_name: 'robmok',
        paper_url: 'https://linkinghub.elsevier.com/retrieve/pii/S1053811919302228',
        parallel_imaging: '',
        private: false,
        proportion_male_subjects: null,
        pulse_sequence: '',
        quality_control: '',
        repetition_time: null,
        resampled_voxel_size: null,
        scanner_make: '',
        scanner_model: '',
        skip_distance: null,
        slice_thickness: null,
        slice_timing_correction_software: '',
        smoothing_fwhm: null,
        smoothing_type: '',
        software_package: '',
        software_version: '',
        subject_age_max: null,
        subject_age_mean: null,
        subject_age_min: null,
        target_resolution: null,
        target_template_image: '',
        transform_similarity_metric: '',
        type_of_design: null,
        url: 'https://neurovault.org/collections/4742/',
        used_b0_unwarping: null,
        used_dispersion_derivatives: null,
        used_high_pass_filter: null,
        used_intersubject_registration: null,
        used_motion_correction: null,
        used_motion_regressors: null,
        used_motion_susceptibiity_correction: null,
        used_orthogonalization: null,
        used_reaction_time_regressor: null,
        used_slice_timing_correction: null,
        used_smoothing: null,
        used_temporal_derivatives: null,
    },
    name: 'Neural markers of category-based selective working memory in aging',
    pmid: null,
    publication: 'NeuroImage',
    source: 'neurovault',
    source_id: '4742',
    source_updated_at: null,
    user: null,
};

const mockStudysets: StudysetsApiResponse[] = [
    {
        created_at: '2021-12-14T05:05:45.722157+00:00',
        description: null,
        doi: null,
        id: '3aBhURzAL4ED',
        name: 'pop',
        pmid: null,
        publication: 'Pharmacology',
        studies: ['3bCzzqrAPn7o'],
        user: 'some-user',
    },
    {
        created_at: '2021-12-14T05:04:16.636105+00:00',
        description: null,
        doi: null,
        id: '8DdVt559vNBy',
        name: 'test set',
        pmid: null,
        publication: null,
        studies: ['3bCzzqrAPn7o', '6K4pEQsdXdBp', '7zSkgFFh7czY', '3gGkPPasNn9v', '5h4Hf6sC82Be'],
        user: 'some-user',
    },
    {
        created_at: '2021-12-14T05:02:16.922240+00:00',
        description: null,
        doi: null,
        id: '4tjSssW6AoD8',
        name: 'abcdef',
        pmid: null,
        publication: null,
        studies: ['3bCzzqrAPn7o', '5h4Hf6sC82Be', '6K4pEQsdXdBp'],
        user: 'some-user',
    },
    {
        created_at: '2021-12-14T02:57:03.222144+00:00',
        description: 'weaf weiunew iuewi ub',
        doi: null,
        id: '7SvedsNoNKbB',
        name: null,
        pmid: null,
        publication: null,
        studies: ['6qLp3fVo9JtR'],
        user: 'some-user',
    },
];

describe('StudysetsPopupMenu', () => {
    const mockHandleStudysetCreated = jest.fn();
    const mockHandleStudyAddedToStudyset = jest.fn();

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        render(
            <StudysetsPopupMenu
                onCreateStudyset={mockHandleStudysetCreated}
                onStudyAddedToStudyset={mockHandleStudyAddedToStudyset}
                studysets={[]}
                study={mockStudy}
            />
        );

        const text = screen.getByText('Add to a studyset...');
        expect(text).toBeInTheDocument();
    });

    it('should have the correct number of studysets', () => {
        render(
            <StudysetsPopupMenu
                onCreateStudyset={mockHandleStudysetCreated}
                onStudyAddedToStudyset={mockHandleStudyAddedToStudyset}
                studysets={mockStudysets}
                study={mockStudy}
            />
        );

        const rows = screen.getAllByRole('menuitem');
        // add one to include the "Create studyset" option
        expect(rows.length).toEqual(mockStudysets.length + 1);
    });

    it('should switch to create studyset mode when the button is clicked', () => {
        render(
            <StudysetsPopupMenu
                onCreateStudyset={mockHandleStudysetCreated}
                onStudyAddedToStudyset={mockHandleStudyAddedToStudyset}
                studysets={mockStudysets}
                study={mockStudy}
            />
        );

        // enable edit mode
        const createStudysetButton = screen.getByText('Create new studyset');
        userEvent.click(createStudysetButton);

        const nameField = screen.getByText('Studyset name');
        const descriptionField = screen.getByText('Studyset description');
        const createButton = screen.getByText('Create');

        expect(nameField).toBeInTheDocument();
        expect(descriptionField).toBeInTheDocument();
        expect(createButton).toBeInTheDocument();
        expect(createButton).toBeDisabled();
    });

    it('should enable the create button when the name is not null', () => {
        render(
            <StudysetsPopupMenu
                onCreateStudyset={mockHandleStudysetCreated}
                onStudyAddedToStudyset={mockHandleStudyAddedToStudyset}
                studysets={mockStudysets}
                study={mockStudy}
            />
        );

        // enable edit mode
        const createStudysetButton = screen.getByText('Create new studyset');
        userEvent.click(createStudysetButton);

        let createButton = screen.getByText('Create');
        expect(createButton).toBeDisabled();

        const nameField = screen.getByLabelText('Studyset name');
        userEvent.type(nameField, 'ABC');

        createButton = screen.getByText('Create');
        expect(createButton).toBeEnabled();
    });

    it('should update the values in edit mode respectively', async () => {
        render(
            <StudysetsPopupMenu
                onCreateStudyset={mockHandleStudysetCreated}
                onStudyAddedToStudyset={mockHandleStudyAddedToStudyset}
                studysets={mockStudysets}
                study={mockStudy}
            />
        );

        // enable edit mode
        const createStudysetButton = screen.getByText('Create new studyset');
        userEvent.click(createStudysetButton);

        const nameField = screen.getByLabelText('Studyset name');
        const descriptionField = screen.getByLabelText('Studyset description');

        expect(nameField).toBeInTheDocument();
        expect(descriptionField).toBeInTheDocument();

        userEvent.type(nameField, 'ABC');
        userEvent.type(descriptionField, 'DEF');

        const updatedNameField = screen.getByDisplayValue('ABC');
        const updatedDescriptionField = screen.getByDisplayValue('DEF');

        expect(updatedNameField).toBeInTheDocument();
        expect(updatedDescriptionField).toBeInTheDocument();
    });

    it('should create a studyset when create is clicked', async () => {
        render(
            <StudysetsPopupMenu
                onCreateStudyset={mockHandleStudysetCreated}
                onStudyAddedToStudyset={mockHandleStudyAddedToStudyset}
                studysets={mockStudysets}
                study={mockStudy}
            />
        );

        // enable edit mode
        const createStudysetButton = screen.getByText('Create new studyset');
        userEvent.click(createStudysetButton);

        // enter in text for the name
        const nameField = screen.getByLabelText('Studyset name');
        userEvent.type(nameField, 'ABC');

        const createButton = screen.getByText('Create');
        await act(async () => {
            userEvent.click(createButton);
        });

        expect(mockHandleStudysetCreated).toBeCalledWith('ABC', '');
    });

    it('should add the study to the clicked studyset', async () => {
        render(
            <StudysetsPopupMenu
                onCreateStudyset={mockHandleStudysetCreated}
                onStudyAddedToStudyset={mockHandleStudyAddedToStudyset}
                studysets={mockStudysets}
                study={mockStudy}
            />
        );

        // enable edit mode
        const createStudysetButton = screen.getByText('Create new studyset');
        userEvent.click(createStudysetButton);

        const menuItem = screen.getByRole('menuitem', { name: 'test set' });

        await act(async () => {
            userEvent.click(menuItem);
        });

        expect(mockHandleStudyAddedToStudyset).toBeCalledWith(mockStudy, mockStudysets[1]);
    });

    it('should handle closing the popper when clickaway is triggered', () => {
        render(
            <StudysetsPopupMenu
                onCreateStudyset={mockHandleStudysetCreated}
                onStudyAddedToStudyset={mockHandleStudyAddedToStudyset}
                studysets={mockStudysets}
                study={mockStudy}
            />
        );

        // "open" popper
        const iconButton = screen.getAllByRole('button')[0];
        userEvent.click(iconButton);

        let mockPopper = screen.getByTestId('mock-popper-open');
        expect(mockPopper).toBeInTheDocument();

        const testTriggerClickAway = screen.getByTestId('trigger-click-away');
        userEvent.click(testTriggerClickAway);

        mockPopper = screen.getByTestId('mock-popper-closed');
        expect(mockPopper).toBeInTheDocument();
    });
});
