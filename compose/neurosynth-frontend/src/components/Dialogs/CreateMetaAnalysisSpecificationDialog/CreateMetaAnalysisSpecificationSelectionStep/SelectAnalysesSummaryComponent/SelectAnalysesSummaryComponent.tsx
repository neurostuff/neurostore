import { Box, Typography } from '@mui/material';
import { EPropertyType } from 'components/EditMetadata';
import { useGetAnnotationById, useGetStudysetById } from 'hooks';
import { useEffect, useState } from 'react';
import { getFilteredAnnotationNotes } from '../SelectAnalysesComponent/SelectAnalysesComponent';
import { AnalysisReturn, NoteCollectionReturn, StudyReturn } from 'neurostore-typescript-sdk';

const SelectAnalysesSummaryComponent: React.FC<{
    annotationdId: string;
    studysetId: string;
    selectedValue:
        | {
              selectionKey: string | undefined;
              type: EPropertyType;
          }
        | undefined;
}> = (props) => {
    const { data: annotation } = useGetAnnotationById(props.annotationdId);
    const { data: studyset } = useGetStudysetById(props.studysetId);

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
            props.selectedValue?.selectionKey
        );

        // populate map
        const filteredAnnotationsToStudyMap = new Map<string, NoteCollectionReturn>();
        const filteredAnnotationsStudyIdSet = new Set<string>();
        for (const filteredAnnotation of filteredAnnotations) {
            if (filteredAnnotation.study) {
                filteredAnnotationsStudyIdSet.add(filteredAnnotation.study);
            }
            if (filteredAnnotation.analysis) {
                filteredAnnotationsToStudyMap.set(filteredAnnotation.analysis, filteredAnnotation);
            }
        }

        let numStudiesSelected = 0;
        let numAnalysesSelected = filteredAnnotations.length;
        let numCoordinatesSelected = 0;
        const countedStudiesSet = new Set<string>();
        (studyset.studies as StudyReturn[]).forEach((study) => {
            if (!filteredAnnotationsStudyIdSet.has(study.id || '')) return;

            ((study.analyses || []) as AnalysisReturn[]).forEach((analysis) => {
                if (filteredAnnotationsToStudyMap.has(analysis.id || '')) {
                    if (!countedStudiesSet.has(study.id || '')) {
                        numStudiesSelected = numStudiesSelected + 1;
                        countedStudiesSet.add(study.id || '');
                    }

                    numCoordinatesSelected =
                        numCoordinatesSelected + (analysis.points || []).length;
                }
            });
        });

        setCount({
            studies: numStudiesSelected,
            analyses: numAnalysesSelected,
            coordinates: numCoordinatesSelected,
        });
    }, [annotation?.notes, props.selectedValue?.selectionKey, studyset?.studies]);

    return (
        <Box sx={{ display: 'flex' }}>
            <Typography sx={{ margin: '0 0.5rem' }} variant="caption">
                {count.studies} studies
            </Typography>{' '}
            |
            <Typography sx={{ margin: '0 0.5rem' }} variant="caption">
                {count.analyses} analyses
            </Typography>{' '}
            |
            <Typography sx={{ margin: '0 0.5rem' }} variant="caption">
                {count.coordinates} coordinates
            </Typography>
        </Box>
    );
};

export default SelectAnalysesSummaryComponent;
