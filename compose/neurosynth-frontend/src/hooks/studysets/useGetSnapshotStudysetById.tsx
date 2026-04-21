import { AxiosResponse } from 'axios';
import { StudysetReturn } from 'neurosynth-compose-typescript-sdk';
import { useQuery } from 'react-query';
import API from 'api/api.config';

const useGetSnapshotStudysetById = (studysetId: string | undefined | null) => {
    return useQuery(
        ['snapshot-studysets', studysetId],
        () => API.NeurosynthServices.StudysetsService.snapshotStudysetsIdGet(studysetId || ''),
        {
            select: (res: AxiosResponse<StudysetReturn>) => res.data,
            enabled: !!studysetId,
        }
    );
};

export default useGetSnapshotStudysetById;
