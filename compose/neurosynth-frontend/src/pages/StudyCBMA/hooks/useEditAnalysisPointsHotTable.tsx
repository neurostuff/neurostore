import { pointsTableHeight } from 'pages/StudyCBMA/components/EditStudyAnalysisCBMAPointsHotTable.helpers';
import { useLayoutEffect, useState } from 'react';
import { useGetStudyIsLoading, useStudyAnalysisPoints } from 'stores/study/StudyStore';
import { getPointWarnings, IStorePoint, PointWarnings } from 'stores/study/StudyStore.helpers';

export type EditAnalysisPointsHotSnapshot = {
    analysisId: string;
    seed: number;
    points: IStorePoint[];
    height: number;
    pointWarnings: PointWarnings;
};

/**
 * One cloned points array per analysis and seed. Later store updates for that same pair do not replace it:
 * Handsontable mutates the row objects, and those objects must not be the store's objects.
 */
const useEditAnalysisPointsHotTable = (analysisId: string | undefined, pointsTableSeed: number) => {
    const points = useStudyAnalysisPoints(analysisId) as IStorePoint[] | null;
    const isLoading = useGetStudyIsLoading();
    const [snapshot, setSnapshot] = useState<EditAnalysisPointsHotSnapshot>();

    useLayoutEffect(() => {
        if (!analysisId || isLoading) return;

        setSnapshot((prev) => {
            if (prev?.analysisId === analysisId && prev.seed === pointsTableSeed) return prev;

            const clonedPoints = (points ?? []).map((point) => ({ ...point }));
            return {
                analysisId,
                seed: pointsTableSeed,
                points: clonedPoints,
                height: pointsTableHeight(clonedPoints.length),
                pointWarnings: getPointWarnings(clonedPoints),
            };
        });
    }, [analysisId, pointsTableSeed, isLoading, points]);

    return snapshot;
};

export default useEditAnalysisPointsHotTable;
