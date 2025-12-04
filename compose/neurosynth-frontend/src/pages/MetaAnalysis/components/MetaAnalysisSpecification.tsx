import { Box, Link, Typography } from '@mui/material';
import { getType } from 'components/EditMetadata/EditMetadata.types';
import { useGetMetaAnalysisById } from 'hooks';
import useGetSpecificationById from 'hooks/metaAnalyses/useGetSpecificationById';
import { Annotation, Specification, SpecificationReturn, Studyset } from 'neurosynth-compose-typescript-sdk';
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
    const metaAnalysisTypeDescription = useMemo(() => {
        return getAnalysisTypeDescription((metaAnalysis?.specification as Specification)?.type);
    }, [metaAnalysis?.specification]);

    const { data: specification } = useGetSpecificationById(
        (metaAnalysis?.specification as SpecificationReturn | undefined)?.id
    );

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

    const metaAnalysisSpecification = metaAnalysis?.specification as Specification | undefined;
    const metaAnalysisAnnotation = metaAnalysis?.annotation as Annotation | undefined;
    const metaAnalysisStudyset = metaAnalysis?.studyset as Studyset | undefined;

    return (
        <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 2, columnGap: 8 }}>
                <Typography variant="h5">Data</Typography>
                <Box></Box>

                <Typography color="primary.dark" variant="body1">
                    Analysis Type
                </Typography>
                <Box>
                    <Typography variant="body1">{metaAnalysisSpecification?.type || ''}</Typography>
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
                    {metaAnalysisStudyset?.neurostore_id || ''}
                </Link>

                <Typography color="primary.dark" variant="body1">
                    Selection
                </Typography>
                <Box>
                    <Typography variant="body1">{selectionText}</Typography>
                    {referenceDataset && (
                        <>
                            <SelectAnalysesSummaryComponent
                                annotationdId={metaAnalysisAnnotation?.neurostore_id || ''}
                                studysetId={metaAnalysisStudyset?.neurostore_id || ''}
                                selectedValue={{
                                    selectionKey: specification?.filter || '',
                                    type: getType(specification?.filter || ''),
                                    selectionValue: specification?.conditions?.[0],
                                }}
                            />
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
                        {getEstimatorDescription(metaAnalysisSpecification?.type, specification?.estimator?.type)}
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
