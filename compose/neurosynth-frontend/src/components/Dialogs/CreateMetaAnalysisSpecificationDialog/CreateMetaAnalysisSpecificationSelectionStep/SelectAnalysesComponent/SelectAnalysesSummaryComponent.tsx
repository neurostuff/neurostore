import { Box, Typography } from '@mui/material';
import { useGetAnnotationById, useGetStudysetById } from 'hooks';
import { AnalysisReturn, NoteCollectionReturn, StudyReturn } from 'neurostore-typescript-sdk';
import { useEffect, useState } from 'react';
import { IAnalysesSelection } from '../../CreateMetaAnalysisSpecificationDialogBase.types';
import { getFilteredAnnotationNotes } from './SelectAnalysesComponent.helpers';

const SelectAnalysesSummaryComponent: React.FC<{
    annotationdId: string;
    studysetId: string;
    selectedValue: IAnalysesSelection | undefined;
}> = (props) => {
    const { data: annotation } = useGetAnnotationById(props.annotationdId);
    const { data: studyset } = useGetStudysetById(props.studysetId, true);

    const [count, setCount] = useState({
        studies: 0,
        analyses: 0,
        coordinates: 0,
    });

    useEffect(() => {
        if (!studyset?.studies || !annotation?.notes || !props.selectedValue?.selectionKey) {
            setCount({ studies: 0, analyses: 0, coordinates: 0 });
            return;
        }

        const filteredAnnotations = getFilteredAnnotationNotes(
            (annotation.notes || []) as NoteCollectionReturn[],
            props.selectedValue
        );

        // populate map
        const filteredAnnotationsAnalysisIdToNoteMap = new Map<string, NoteCollectionReturn>();
        const filteredAnnotationsStudyIdSet = new Set<string>();
        for (const filteredAnnotation of filteredAnnotations) {
            if (filteredAnnotation.study) {
                filteredAnnotationsStudyIdSet.add(filteredAnnotation.study);
            }
            if (filteredAnnotation.analysis) {
                filteredAnnotationsAnalysisIdToNoteMap.set(
                    filteredAnnotation.analysis,
                    filteredAnnotation
                );
            }
        }

        let numStudiesSelected = 0;
        let numAnalysesSelected = filteredAnnotations.length;
        let numCoordinatesSelected = 0;
        (studyset.studies as StudyReturn[]).forEach((study) => {
            if (!study.id || !filteredAnnotationsStudyIdSet.has(study.id)) return;

            if (study.analyses && study.analyses.length) numStudiesSelected++;

            ((study.analyses || []) as AnalysisReturn[]).forEach((analysis) => {
                if (!analysis.id || !filteredAnnotationsAnalysisIdToNoteMap.has(analysis.id)) {
                    return;
                }

                numCoordinatesSelected = numCoordinatesSelected + (analysis.points || []).length;
            });
        });

        setCount({
            studies: numStudiesSelected,
            analyses: numAnalysesSelected,
            coordinates: numCoordinatesSelected,
        });
    }, [
        annotation?.notes,
        props.selectedValue,
        props.selectedValue?.selectionKey,
        studyset?.studies,
    ]);

    return (
        <Box sx={{ display: 'flex' }}>
            <Typography sx={{ marginRight: '0.5rem' }} variant="caption">
                {count.studies} studies
            </Typography>{' '}
            |
            <Typography sx={{ margin: '0 0.5rem' }} variant="caption">
                {count.analyses} analyses
            </Typography>{' '}
            |
            <Typography sx={{ marginLeft: '0.5rem' }} variant="caption">
                {count.coordinates} coordinates
            </Typography>
        </Box>
    );
};

export default SelectAnalysesSummaryComponent;
