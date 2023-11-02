import {
    useStudyAnalyses,
    useStudyAnalysisName,
    useStudyAnalysisPoints,
} from 'pages/Studies/StudyStore';
import { IStorePoint } from 'pages/Studies/StudyStore.helpers';
import { useMemo } from 'react';

export const isCoordinateMNI = (x: number, y: number, z: number) => {
    const dims = {
        xMax: 90,
        xMin: -90,
        yMax: 90,
        yMin: -126,
        zMax: 108,
        zMin: -72,
    };

    return (
        x <= dims.xMax &&
        x >= dims.xMin &&
        y <= dims.yMax &&
        y >= dims.yMin &&
        z <= dims.zMax &&
        z >= dims.zMin
    );
};

const useDisplayWarnings = (analysisId?: string) => {
    const points = useStudyAnalysisPoints(analysisId) as IStorePoint[] | null;
    const name = useStudyAnalysisName(analysisId);
    const analyses = useStudyAnalyses();

    const hasNoPoints = useMemo(() => (points?.length || 0) === 0, [points]);
    const hasNoName = useMemo(() => (name || '').length === 0, [name]);
    const hasDuplicateName = useMemo(
        () => analyses.filter((x) => x.id !== analysisId).some((x) => x.name === name),
        [analyses, analysisId, name]
    );

    const hasNonMNICoordinates = useMemo(
        () =>
            (points || []).some((x) => {
                return !isCoordinateMNI(x.x || 0, x.y || 0, x.z || 0);
            }),
        [points]
    );

    return {
        hasNoPoints,
        hasNoName,
        hasDuplicateName,
        hasNonMNICoordinates,
    };
};

export default useDisplayWarnings;
