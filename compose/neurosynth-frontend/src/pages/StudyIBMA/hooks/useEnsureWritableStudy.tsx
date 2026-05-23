import {
    useGetAnalysesByStudyId,
    useGetStudyNonNestedById,
    useGetUncategorizedImagesByStudyId,
    useUserCanEdit,
} from 'hooks';
import analysisQueries from 'hooks/analyses/analysisQueries';
import type { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import { StudyReturnNested } from 'hooks/studies/studyQueries.types';
import type { ImageReturn, StudyRequest } from 'neurostore-typescript-sdk';
import {
    buildClonedStudyIdMap,
    buildStudySnapshot as buildEnsureWriteableStudySnapshot,
    type ClonedStudyIdMap,
} from 'pages/StudyIBMA/hooks/buildWritableStudyIdMapping.helpers';
import useCloneStudy from 'pages/StudyIBMA/hooks/useCloneStudy';
import { useCallback } from 'react';
import { useQueryClient } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';

const EMPTY_ANALYSES: AnalysisReturnNested[] = [];
const EMPTY_UNCATEGORIZED_IMAGES: ImageReturn[] = [];

type EnsureWritableStudyOptions = {
    /** Applied when cloning (e.g. study details form). Defaults to `{}` for board actions. */
    studyRequest?: StudyRequest;
};

type EnsureWritableStudyResult = {
    studyId: string;
    didClone: boolean;
    /** Maps board ids to ids on the writable study (identity when owned, remapped after clone). */
    idMap: ClonedStudyIdMap;
};

const useEnsureWritableStudy = () => {
    const { projectId, studyId } = useParams<{ projectId: string; studyId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: study } = useGetStudyNonNestedById(studyId);
    const { data: analyses = EMPTY_ANALYSES } = useGetAnalysesByStudyId(studyId);
    const { data: uncategorizedImages = EMPTY_UNCATEGORIZED_IMAGES } = useGetUncategorizedImagesByStudyId(studyId);
    const userOwnsStudy = useUserCanEdit(study?.user ?? undefined);
    const { cloneStudy, isLoading: cloneStudyIsLoading } = useCloneStudy();

    const buildCloneSnapshot = useCallback(
        async (clonedStudy: StudyReturnNested) => {
            const clonedStudyId = clonedStudy.id;
            if (!clonedStudyId) throw new Error('cloned study is missing an id');

            const uncategorizedQuery = analysisQueries.images.uncategorizedByStudyId(clonedStudyId);
            const clonedUncategorized = uncategorizedQuery.enabled
                ? await queryClient.fetchQuery(uncategorizedQuery.queryKey, uncategorizedQuery.queryFn)
                : EMPTY_UNCATEGORIZED_IMAGES;

            return buildEnsureWriteableStudySnapshot(clonedStudyId, clonedStudy.analyses ?? [], clonedUncategorized);
        },
        [queryClient]
    );

    const ensureWritableStudy = useCallback(
        async (override?: EnsureWritableStudyOptions): Promise<EnsureWritableStudyResult | undefined> => {
            if (!studyId || !study?.id) return undefined;

            if (userOwnsStudy) {
                const snapshot = buildEnsureWriteableStudySnapshot(studyId, analyses, uncategorizedImages);
                return { studyId, didClone: false, idMap: buildClonedStudyIdMap(snapshot, snapshot) };
            }

            const oldSnapshot = buildEnsureWriteableStudySnapshot(studyId, analyses, uncategorizedImages);
            // if override is an empty object, the backend will just clone the study as is
            const clonedStudy = await cloneStudy(override?.studyRequest ?? {});
            if (!clonedStudy?.id) return undefined;

            const newSnapshot = await buildCloneSnapshot(clonedStudy);
            const idMap = buildClonedStudyIdMap(oldSnapshot, newSnapshot);

            navigate(`/projects/${projectId}/extraction/studies/${clonedStudy.id}/edit`);

            return {
                studyId: clonedStudy.id,
                didClone: true,
                idMap,
            };
        },
        [
            analyses,
            buildCloneSnapshot,
            cloneStudy,
            navigate,
            projectId,
            study?.id,
            studyId,
            uncategorizedImages,
            userOwnsStudy,
        ]
    );

    return { ensureWritableStudy, isLoading: cloneStudyIsLoading, userOwnsStudy };
};

export default useEnsureWritableStudy;
