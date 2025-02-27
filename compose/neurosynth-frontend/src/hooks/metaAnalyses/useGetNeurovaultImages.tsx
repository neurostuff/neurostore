import axios, { AxiosResponse } from 'axios';
import { useQuery } from 'react-query';

export interface INeurovault {
    url: string | null;
    id: number | null;
    file: string | null;
    collection: string | null;
    collection_id: number | null;
    file_size: number | null;
    cognitive_paradigm_cogatlas: string | null;
    cognitive_paradigm_cogatlas_id: string | null;
    cognitive_contrast_cogatlas: string | null;
    cognitive_contrast_cogatlas_id: string | null;
    map_type: string | null;
    analysis_level: string | null;
    name: string | null;
    description: string | null;
    add_date: string | null;
    modify_date: string | null;
    is_valid: boolean;
    surface_left_file: string | null;
    surface_right_file: string | null;
    data_origin: string | null;
    target_template_image: string | null;
    subject_species: string | null;
    figure: string | null;
    handedness: string | null;
    age: string | null;
    gender: string | null;
    race: string | null;
    ethnicity: string | null;
    BMI: string | null;
    fat_percentage: string | null;
    waist_hip_ratio: string | null;
    mean_PDS_score: string | null;
    tanner_stage: string | null;
    days_since_menstruation: string | null;
    hours_since_last_meal: string | null;
    bis_bas_score: string | null;
    spsrq_score: string | null;
    bis11_score: string | null;
    thumbnail: string | null;
    reduced_representation: string | null;
    is_thresholded: boolean | null;
    perc_bad_voxels: number | null;
    not_mni: boolean | null;
    brain_coverage: number | null;
    perc_voxels_outside: number | null;
    number_of_subjects: string | null;
    modality: string | null;
    statistic_parameters: string | null;
    smoothness_fwhm: string | null;
    contrast_definition: string | null;
    contrast_definition_cogatlas: string | null;
    cognitive_paradigm_description_url: string | null;
    image_type: string | null;
}

function useGetNeurovaultImages(neurovaultImages: string[]) {
    return useQuery({
        queryKey: ['neurovault-images', ...neurovaultImages],

        queryFn: async () => {
            const res = await Promise.all<AxiosResponse<INeurovault>>(neurovaultImages.map((url) => axios.get(url)));

            return res.map((x) => ({
                ...x.data,
                file: (x.data.file || '').replace(/http/, 'https'), // without this, link will redirect but result in an error
            }));
        },
        enabled: neurovaultImages.length > 0,
    });
}

export default useGetNeurovaultImages;
