import { Box, Link, Typography } from '@mui/material';
import { getType } from 'components/EditMetadata/EditMetadata.types';
import {
    getMetaAnalysisAnnotationId,
    getMetaAnalysisSpecificationId,
    getMetaAnalysisStudysetId,
} from 'helpers/MetaAnalysis.helpers';
import { useGetMetaAnalysisById } from 'hooks';
import useGetSnapshotAnnotationById from 'hooks/annotations/useGetSnapshotAnnotationById';
import useGetSpecificationById from 'hooks/metaAnalyses/useGetSpecificationById';
import useGetSnapshotStudysetById from 'hooks/studysets/useGetSnapshotStudysetById';
import { AnnotationReturn, StudysetReturn } from 'neurosynth-compose-typescript-sdk';
import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { getAnalysisTypeDescription, getEstimatorDescription } from '../MetaAnalysisPage.helpers';
import { IDynamicValueType } from './DynamicForm.types';
import DynamicInputDisplay from './DynamicInputDisplay';
import { isMultiGroupAlgorithm } from './SelectAnalysesComponent.helpers';
import SelectAnalysesSummaryComponent from './SelectAnalysesSummaryComponent';

const DisplayMetaAnalysisSpecification: React.FC<{ projectId: string; metaAnalysisId: string }> = ({
    projectId,
    metaAnalysisId,
}) => {
    const { data: metaAnalysis } = useGetMetaAnalysisById(metaAnalysisId);
    const specificationId = getMetaAnalysisSpecificationId(metaAnalysis);
    const annotationId = getMetaAnalysisAnnotationId(metaAnalysis);
    const studysetId = getMetaAnalysisStudysetId(metaAnalysis);
    const { data: annotation } = useGetSnapshotAnnotationById(annotationId);
    const { data: studyset } = useGetSnapshotStudysetById(studysetId);
    const { data: specification } = useGetSpecificationById(specificationId);

    const metaAnalysisTypeDescription = useMemo(() => {
        return getAnalysisTypeDescription(specification?.type);
    }, [specification?.type]);

    const selectionText = useMemo(() => {
        if (!specification || !specification.filter || !specification.conditions) return '';
        const selectionKey = specification.filter;
        const selectionValue = specification.conditions[0] ? `: ${specification.conditions[0]}` : '';
        return `${selectionKey} ${selectionValue}`;
    }, [specification]);

    const referenceDataset = useMemo(() => {
        const isMulti = isMultiGroupAlgorithm({
            label: specification?.estimator?.type || '',
            description: '',
        });

        if (isMulti) {
            return specification?.conditions?.[1] !== undefined
                ? specification.conditions[1].toString()
                : specification?.database_studyset;
        } else {
            return null;
        }
    }, [specification?.conditions, specification?.database_studyset, specification?.estimator?.type]);

    return (
        <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 2, columnGap: 8 }}>
                <Typography variant="h5">Data</Typography>
                <Box></Box>

                <Typography color="primary.dark" variant="body1">
                    Analysis Type
                </Typography>
                <Box>
                    <Typography variant="body1">{specification?.type || ''}</Typography>
                    <Typography variant="body2">{metaAnalysisTypeDescription}</Typography>
                </Box>

                <Typography color="primary.dark" variant="body1">
                    Studyset ID
                </Typography>
                <Link
                    component={RouterLink}
                    variant="body1"
                    underline="hover"
                    to={`/projects/${projectId}/extraction`}
                    target="_blank"
                >
                    {(studyset as StudysetReturn | undefined)?.neurostore_id || ''}
                </Link>

                <Typography color="primary.dark" variant="body1">
                    Selection
                </Typography>
                <Box>
                    <Typography variant="body1">{selectionText}</Typography>
                    {referenceDataset && (
                        <>
                            {!!(annotation as AnnotationReturn | undefined)?.neurostore_id &&
                                !!(studyset as StudysetReturn | undefined)?.neurostore_id && (
                                    <SelectAnalysesSummaryComponent
                                        annotationdId={(annotation as AnnotationReturn).neurostore_id || ''}
                                        studysetId={(studyset as StudysetReturn).neurostore_id || ''}
                                        selectedValue={{
                                            selectionKey: specification?.filter || '',
                                            type: getType(specification?.filter || ''),
                                            selectionValue: specification?.conditions?.[0],
                                        }}
                                    />
                                )}
                            <Typography
                                sx={{
                                    marginTop: '1rem',
                                    color: 'gray',
                                }}
                            >
                                Reference Dataset: {referenceDataset}
                            </Typography>
                        </>
                    )}
                </Box>

                <Typography variant="h5">Algorithm</Typography>
                <Box></Box>

                <Typography color="primary.dark" variant="body1">
                    Algorithm and optional arguments
                </Typography>
                <Box>
                    <Typography variant="body1">{specification?.estimator?.type || ''}</Typography>
                    <Typography variant="body2">
                        {getEstimatorDescription(specification?.type, specification?.estimator?.type)}
                    </Typography>
                    <DynamicInputDisplay dynamicArg={(specification?.estimator?.args || {}) as IDynamicValueType} />
                </Box>

                {specification?.corrector?.type && (
                    <>
                        <Typography color="primary.dark" variant="body1">
                            Corrector and optional arguments
                        </Typography>
                        <Box>
                            <Typography variant="body1">{specification?.corrector?.type || ''}</Typography>
                            <DynamicInputDisplay
                                dynamicArg={(specification?.corrector?.args || {}) as IDynamicValueType}
                            />
                        </Box>
                    </>
                )}
            </Box>
        </Box>
    );
};

export default DisplayMetaAnalysisSpecification;
