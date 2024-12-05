import axios, { AxiosResponse } from 'axios';
import { useQuery } from 'react-query';

export interface INeurovault {
    url: string;
    id: number;
    file: string;
    collection: string;
    collection_id: string;
    file_size: string;
    cognitive_paradigm_cogatlas: string;
    cognitive_paradigm_cogatlas_id: string;
    cognitive_contrast_cogatlas: string;
    cognitive_contrast_cogatlas_id: string;
    map_type: string;
    analysis_level: string;
    name: string;
    description: string;
    add_date: string;
    modify_date: string;
    is_valid: boolean;
    surface_left_file: string;
    surface_right_file: string;
    data_origin: string;
    target_template_image: string;
    subject_species: string;
    figure: string;
    handedness: string;
    age: string;
    gender: string;
    race: string;
    ethnicity: string;
    BMI: string;
    fat_percentage: string;
    waist_hip_ratio: string;
    mean_PDS_score: string;
    tanner_stage: string;
    days_since_menstruation: string;
    hours_since_last_meal: string;
    bis_bas_score: string;
    spsrq_score: string;
    bis11_score: string;
    thumbnail: string;
    reduced_representation: string;
    is_thresholded: boolean;
    perc_bad_voxels: number;
    not_mni: boolean;
    brain_coverage: number;
    perc_voxels_outside: number;
    number_of_subjects: string;
    modality: string;
    statistic_parameters: string;
    smoothness_fwhm: string;
    contrast_definition: string;
    contrast_definition_cogatlas: string;
    cognitive_paradigm_description_url: string;
    image_type: string;
}

function useGetNeurovaultImages(neurovaultImages: string[]) {
    return useQuery({
        queryKey: ['neurovault-images', ...neurovaultImages],
        queryFn: async () => {
            const res = await Promise.all<AxiosResponse<INeurovault>>(neurovaultImages.map((url) => axios.get(url)));
            return res.map((x) => ({
                ...x.data,
                file: x.data.file.replace(/http/, 'https'),
            }));
        },
        enabled: neurovaultImages.length > 0,
    });
}

export default useGetNeurovaultImages;
