import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import type { AnalysisBoardRow, BrainMapListItem } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import { DefaultMapTypes, type IStoreAnalysis } from 'stores/study/StudyStore.helpers';

/**
 * Images whose `analysis` FK matches a known analysis id are grouped under that analysis.
 * Images missing or pointing outside the study are listed as uncategorized.
 */
export function partitionAnalysisImages(analyses: AnalysisReturnNested[]): {
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

export function findImageById(imageId: string | undefined, analyses: AnalysisReturnNested[]): ImageReturn | undefined {
    if (!imageId) return undefined;

    const flat = analyses.flatMap((analysis) => (analysis.images ?? []) as ImageReturn[]);
    return flat.find((image) => image.id === imageId);
}

export function noteTypeToCellType(t: EPropertyType): 'boolean' | 'string' | 'number' {
    if (t === EPropertyType.BOOLEAN) return 'boolean';
    if (t === EPropertyType.NUMBER) return 'number';
    return 'string';
}

export function imagesFingerprint(images: ImageReturn[] | undefined): string {
    return (images ?? [])
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
    const ak = Object.keys(a.analysisAnnotation);
    const bk = Object.keys(b.analysisAnnotation);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
        if (a.analysisAnnotation[k] !== b.analysisAnnotation[k]) return false;
    }
    return true;
}
