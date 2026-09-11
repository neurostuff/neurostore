import { Box, Typography } from '@mui/material';
import { useGetAnnotationById, useGetStudysetSummaryById } from 'hooks';
import { EAnalysisType } from 'hooks/projects/Project.types';
import { StudyReturnWithSummaryAnalyses } from 'hooks/studysets/studysetQueries.types';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useEffect, useState } from 'react';
import { IAnalysesSelection } from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationDialogBase.types';
import { useProjectAnalysisType } from 'stores/projects/ProjectStore';
import { getFilteredAnnotationNotes } from './SelectAnalysesComponent.helpers';

const SelectAnalysesSummaryComponent = (props: {
    annotationdId: string;
    studysetId: string;
    selectedValue: IAnalysesSelection | undefined;
}) => {
    const { data: annotation } = useGetAnnotationById(props.annotationdId);
    const { data: studyset } = useGetStudysetSummaryById(props.studysetId);
    const isIbma = (useProjectAnalysisType() ?? EAnalysisType.CBMA) === EAnalysisType.IBMA;

    const [count, setCount] = useState({
        studies: 0,
        analyses: 0,
        analysisItems: 0,
    });

    useEffect(() => {
        if (!studyset?.studies || !annotation?.notes || !props.selectedValue?.selectionKey) {
            setCount({ studies: 0, analyses: 0, analysisItems: 0 });
            return;
        }

        const filteredAnnotations = getFilteredAnnotationNotes(annotation.notes ?? [], props.selectedValue);

        // populate map
        const filteredAnnotationsAnalysisIdToNoteMap = new Map<string, NoteCollectionReturn>();
        const filteredAnnotationsStudyIdSet = new Set<string>();
        for (const filteredAnnotation of filteredAnnotations) {
            if (filteredAnnotation.study) {
                filteredAnnotationsStudyIdSet.add(filteredAnnotation.study);
            }
            if (filteredAnnotation.analysis) {
                filteredAnnotationsAnalysisIdToNoteMap.set(filteredAnnotation.analysis, filteredAnnotation);
            }
        }

        let numStudiesSelected = 0;
        const numAnalysesSelected = filteredAnnotations.length;
        let numObservationsSelected = 0;
        (studyset.studies as StudyReturnWithSummaryAnalyses[]).forEach((study) => {
            if (!study.id || !filteredAnnotationsStudyIdSet.has(study.id)) return;

            if (study.analyses && study.analyses.length) numStudiesSelected++;

            (study.analyses || []).forEach((analysis) => {
                if (!analysis.id || !filteredAnnotationsAnalysisIdToNoteMap.has(analysis.id)) {
                    return;
                }

                if (isIbma) {
                    if (typeof analysis.image_count !== 'number') {
                        throw new Error('Expected analysis.image_count in summary studyset payload');
                    }
                    numObservationsSelected = numObservationsSelected + analysis.image_count;
                    return;
                }

                if (typeof analysis.point_count !== 'number') {
                    throw new Error('Expected analysis.point_count in summary studyset payload');
                }

                numObservationsSelected = numObservationsSelected + analysis.point_count;
            });
        });

        setCount({
            studies: numStudiesSelected,
            analyses: numAnalysesSelected,
            analysisItems: numObservationsSelected,
        });
    }, [annotation?.notes, isIbma, props.selectedValue, props.selectedValue?.selectionKey, studyset?.studies]);

    return (
        <Box sx={{ display: 'flex' }}>
            <Typography sx={{ marginRight: '0.5rem' }} variant="caption">
                Included:
            </Typography>{' '}
            <Typography sx={{ marginRight: '0.5rem', whiteSpace: 'nowrap' }} variant="caption">
                {count.studies} studies
            </Typography>{' '}
            |
            <Typography sx={{ margin: '0 0.5rem', whiteSpace: 'nowrap' }} variant="caption">
                {count.analyses} analyses
            </Typography>{' '}
            |
            <Typography sx={{ marginLeft: '0.5rem', whiteSpace: 'nowrap' }} variant="caption">
                {count.analysisItems} {isIbma ? 'images' : 'coordinates'}
            </Typography>
        </Box>
    );
};

export default SelectAnalysesSummaryComponent;
