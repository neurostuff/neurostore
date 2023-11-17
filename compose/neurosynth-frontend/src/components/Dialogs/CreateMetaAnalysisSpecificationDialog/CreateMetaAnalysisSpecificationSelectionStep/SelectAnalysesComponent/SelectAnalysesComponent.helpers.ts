import { EPropertyType } from 'components/EditMetadata';
import { AnnotationNoteValue } from 'components/HotTables/HotTables.types';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { IAnalysesSelection } from '../../CreateMetaAnalysisSpecificationDialogBase.types';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { DEFAULT_REFERENCE_DATASETS } from './SelectAnalysesComponent.types';

// TODO: instead of hardcoding this, we should add a property to the meta-analysis spec with something like: "multi-group" or something similar
export const MULTIGROUP_ALGORITHMS = ['MKDAChi2', 'ALESubtraction'];

export const isMultiGroupAlgorithm = (estimator: IAutocompleteObject | null | undefined) => {
    if (!estimator) return false;
    return MULTIGROUP_ALGORITHMS.some(
        (multigroupAlgorithm) => estimator.label === multigroupAlgorithm
    );
};

export const getFilteredAnnotationNotes = (
    annotationNotes: NoteCollectionReturn[],
    selectedValue: IAnalysesSelection | undefined
): NoteCollectionReturn[] => {
    if (!annotationNotes || !selectedValue || !selectedValue.selectionKey) return [];
    const { selectionKey, type, selectionValue } = selectedValue;

    switch (type) {
        case EPropertyType.STRING:
            if (!selectionValue) return [];
            return annotationNotes.filter((x) => {
                const annotationNote = x.note as { [key: string]: AnnotationNoteValue };
                return annotationNote[selectionKey] === selectionValue;
            });
        case EPropertyType.BOOLEAN:
            return annotationNotes.filter((x) => {
                const annotationNote = x.note as { [key: string]: AnnotationNoteValue };
                return annotationNote[selectionKey] === true; // for now, we only care about boolean filters. Later, the filter process will get more complicated
            });
        case EPropertyType.NONE:
        default:
            return [];
    }
};

export interface IStudyAnalysesTableFormat {
    studyName: string;
    studyId: string;
    analyses: { analysisName: string; analysisId: string; isSelected: boolean }[];
}

// we can assume that the input is already sorted
export const annotationNotesToTableFormatHelper = (
    notes: NoteCollectionReturn[],
    selectedNotes: NoteCollectionReturn[]
) => {
    let currStudy = '';
    const tableFormat: IStudyAnalysesTableFormat[] = [];

    const selectedNotesMap = new Map();
    selectedNotes.forEach((note) => selectedNotesMap.set(note.analysis, note));

    [...notes]
        .sort((a, b) => {
            const firstStudyId = a.study as string;
            const secondStudyId = b.study as string;
            return firstStudyId.localeCompare(secondStudyId);
        })
        .forEach((note) => {
            if (note.study === currStudy) {
                tableFormat[tableFormat.length - 1].analyses.push({
                    analysisId: note.analysis as string,
                    analysisName: note.analysis_name as string,
                    isSelected: selectedNotesMap.has(note.analysis),
                });
            } else {
                currStudy = note.study as string;
                tableFormat.push({
                    studyName: note.study_name as string,
                    studyId: note.study as string,
                    analyses: [
                        {
                            analysisId: note.analysis as string,
                            analysisName: note.analysis_name as string,
                            isSelected: selectedNotesMap.has(note.analysis),
                        },
                    ],
                });
            }
        });

    return tableFormat;
};

export const selectedReferenceDatasetIsDefault = (selectedReferenceDataset: string | undefined) => {
    if (!selectedReferenceDataset) return false;

    return DEFAULT_REFERENCE_DATASETS.some((x) => x.label === selectedReferenceDataset);
};
