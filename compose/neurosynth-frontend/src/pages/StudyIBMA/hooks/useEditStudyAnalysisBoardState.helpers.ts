import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import type { AnalysisBoardRow, BrainMapListItem } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import { DefaultMapTypes, type IStoreAnalysis } from 'stores/study/StudyStore.helpers';

/**
 * Images whose `analysis` FK matches a known analysis id are grouped under that analysis.
 * Images missing or pointing outside the study are listed as uncategorized.
 */
export function partitionAnalysisImages(analyses: IStoreAnalysis[]): {
    uncategorized: ImageReturn[];
    analysisIdToImageMap: Record<string, ImageReturn[]>;
} {
    const knownIds = new Set((analyses.map((a) => a.id).filter(Boolean) as string[]) ?? []);
    const analysisIdToImageMap: Record<string, ImageReturn[]> = {};
    const uncategorized: ImageReturn[] = [];
    const seenAssigned = new Set<string>();

    for (const analysis of analyses) {
        if (!analysis.id) continue;
        for (const img of (analysis.images ?? []) as ImageReturn[]) {
            if (!img.id) continue;
            // TODO: change this logic so that it reads the Analysis Object flag - it will be codified in the backend
            // that one analysis will be uncategorized
            if (img.analysis && knownIds.has(img.analysis)) {
                if (seenAssigned.has(img.id)) continue;
                seenAssigned.add(img.id);
                if (!analysisIdToImageMap[img.analysis]) analysisIdToImageMap[img.analysis] = [];
                analysisIdToImageMap[img.analysis].push(img);
            } else {
                uncategorized.push(img);
            }
        }
    }

    return { uncategorized, analysisIdToImageMap };
}

export function imageToBrainMapListItem(img: ImageReturn): BrainMapListItem {
    const raw = (img.value_type || 'OTHER').toString().toUpperCase();
    const mapType = (raw in DefaultMapTypes ? raw : 'OTHER') as keyof typeof DefaultMapTypes;
    return {
        id: img.id || '',
        name: (img.filename || img.url || 'Image').trim() || 'Image',
        mapType,
    };
}

export function findImageById(imageId: string | undefined, analyses: IStoreAnalysis[]): ImageReturn | undefined {
    if (!imageId) return undefined;

    const flat = analyses.flatMap((analysis) => (analysis.images ?? []) as ImageReturn[]);
    return flat.find((image) => image.id === imageId);
}

export function removeImageFromAnalyses(
    analyses: IStoreAnalysis[],
    imageId: string
): { next: IStoreAnalysis[]; removed?: ImageReturn } {
    let removed: ImageReturn | undefined;
    const next = analyses.map((a) => ({
        ...a,
        images: ((a.images ?? []) as ImageReturn[]).filter((i) => {
            if (i.id === imageId) {
                removed = i;
                return false;
            }
            return true;
        }),
    }));
    return { next, removed };
}

export function addImageToAnalysis(
    analyses: IStoreAnalysis[],
    targetAnalysisId: string,
    image: ImageReturn
): IStoreAnalysis[] {
    return analyses.map((a) => {
        if (a.id !== targetAnalysisId) return a;
        const imgs = (a.images ?? []) as ImageReturn[];
        return {
            ...a,
            images: [...imgs, { ...image, analysis: targetAnalysisId }],
        };
    });
}

/** Removes the image wherever it appears, then attaches it to `targetAnalysisId`. */
export function moveBrainMapImageToAnalysis(
    analyses: IStoreAnalysis[],
    imageId: string,
    targetAnalysisId: string
): IStoreAnalysis[] | null {
    const { next: afterRemove, removed } = removeImageFromAnalyses(analyses, imageId);
    if (!removed) return null;
    return addImageToAnalysis(afterRemove, targetAnalysisId, { ...removed, analysis: targetAnalysisId });
}

/** Clears `analysis` on the image so `partitionAnalysisImages` lists it as uncategorized. */
export function unassignBrainMapImageFromAnalysis(
    analyses: IStoreAnalysis[],
    analysisId: string,
    imageId: string
): IStoreAnalysis[] {
    return analyses.map((a) => {
        if (a.id !== analysisId) return a;
        return {
            ...a,
            images: ((a.images ?? []) as ImageReturn[]).map((i) =>
                i.id === imageId ? { ...i, analysis: undefined } : i
            ),
        };
    });
}

export function noteTypeToCellType(t: EPropertyType): 'boolean' | 'string' | 'number' {
    if (t === EPropertyType.BOOLEAN) return 'boolean';
    if (t === EPropertyType.NUMBER) return 'number';
    return 'string';
}

export function imagesFingerprint(images: IStoreAnalysis['images'] | undefined): string {
    return ((images ?? []) as ImageReturn[])
        .map((i) => `${i.id ?? ''}:${i.analysis ?? ''}`)
        .sort()
        .join('|');
}

export function syncImageMutationsToStore(
    before: IStoreAnalysis[],
    after: IStoreAnalysis[],
    addOrUpdateAnalysis: (analysis: Partial<IStoreAnalysis>) => IStoreAnalysis
) {
    const oldById = new Map(before.filter((a) => a.id).map((a) => [a.id!, a]));
    after.forEach((upd) => {
        if (!upd.id) return;
        const old = oldById.get(upd.id);
        if (!old) return;
        if (imagesFingerprint(old.images) !== imagesFingerprint(upd.images)) {
            addOrUpdateAnalysis({ id: upd.id, images: upd.images });
        }
    });
}

export function analysisRowsShallowEqual(a: AnalysisBoardRow, b: AnalysisBoardRow): boolean {
    if (a.id !== b.id) return false;
    if (a.name !== b.name || a.description !== b.description) return false;
    const ak = Object.keys(a.annotation);
    const bk = Object.keys(b.annotation);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
        if (a.annotation[k] !== b.annotation[k]) return false;
    }
    return true;
}
