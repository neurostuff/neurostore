import type { ImageReturn } from 'neurostore-typescript-sdk';
import type { AnalysisBoardRow, BrainMapListItem } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import { DefaultMapTypes } from 'stores/study/StudyStore.helpers';

export function imageToBrainMapListItem(img: ImageReturn): BrainMapListItem {
    const raw = (img.value_type || 'OTHER').toString().toUpperCase();
    const mapType = (raw in DefaultMapTypes ? raw : 'OTHER') as keyof typeof DefaultMapTypes;
    return {
        id: img.id || '',
        name: (img.filename || img.url || 'Image').trim() || 'Image',
        mapType,
    };
}

export function analysisRowsShallowEqual(a: AnalysisBoardRow, b: AnalysisBoardRow): boolean {
    if (a.id !== b.id) return false;
    if (a.name !== b.name || a.description !== b.description) return false;
    const ak = Object.keys(a.analysisAnnotation);
    const bk = Object.keys(b.analysisAnnotation);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
        if (a.analysisAnnotation[k] !== b.analysisAnnotation[k]) return false;
    }
    return true;
}
