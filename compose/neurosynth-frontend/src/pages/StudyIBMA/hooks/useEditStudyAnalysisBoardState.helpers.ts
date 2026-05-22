import type { ImageReturn } from 'neurostore-typescript-sdk';
import type { AnalysisBoardRow, BrainMapListItem } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import { DefaultMapTypes } from 'stores/study/StudyStore.helpers';

export const sortAnalysesByOrder = <T extends { order?: number | null; id?: string | null }>(analyses: T[]): T[] => {
    return [...analyses].sort((left, right) => {
        const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return (left.id ?? '').localeCompare(right.id ?? '');
    });
};

export const sortImages = (images: ImageReturn[]): ImageReturn[] => {
    return [...images].sort((left, right) => {
        const filenameCompare = (left.filename ?? '').localeCompare(right.filename ?? '');
        if (filenameCompare !== 0) return filenameCompare;
        const urlCompare = (left.url ?? '').localeCompare(right.url ?? '');
        if (urlCompare !== 0) return urlCompare;
        return (left.id ?? '').localeCompare(right.id ?? '');
    });
};

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
