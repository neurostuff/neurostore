import { AxiosError } from 'axios';
import { StudysetReturn } from 'neurosynth-compose-typescript-sdk';
import { useQuery } from 'react-query';
import API from 'api/api.config';

const useGetSnapshotStudysetById = (studysetId: string | undefined | null) => {
    return useQuery<StudysetReturn | null>(
        ['snapshot-studysets', studysetId],
        async () => {
            try {
                const res = await API.NeurosynthServices.StudysetsService.snapshotStudysetsIdGet(studysetId || '');
                return res.data;
            } catch (error) {
                if ((error as AxiosError)?.response?.status === 404) {
                    return null;
                }
                throw error;
            }
        },
        {
            enabled: !!studysetId,
        }
    );
};

export default useGetSnapshotStudysetById;
