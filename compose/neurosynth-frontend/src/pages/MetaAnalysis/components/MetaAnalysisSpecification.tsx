import { Box, Link, Typography } from '@mui/material';
import { getType } from 'components/EditMetadata/EditMetadata.types';
import { useGetMetaAnalysisById } from 'hooks';
import useGetSpecificationById from 'hooks/metaAnalyses/useGetSpecificationById';
import { Annotation, Specification, SpecificationReturn, Studyset } from 'neurosynth-compose-typescript-sdk';
import React, { useMemo } from 'react';
import { getAnalysisTypeDescription, getEstimatorDescription } from '../MetaAnalysisPage.helpers';
import { IDynamicValueType } from './DynamicForm.types';
import DynamicInputDisplay from './DynamicInputDisplay';
import MetaAnalysisSummaryRow from './MetaAnalysisSummaryRow';
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
            <Box>
                <Typography sx={{ fontWeight: 'bold' }}>Data</Typography>

                <MetaAnalysisSummaryRow
                    title="analysis type"
                    value={metaAnalysisSpecification?.type || ''}
                    caption={metaAnalysisTypeDescription}
                />

                <MetaAnalysisSummaryRow
                    title="studyset id"
                    value={
                        <Link
                            sx={{ cursor: 'pointer' }}
                            onClick={() => {
                                window.open(`/projects/${projectId}/extraction`, '_blank');
                            }}
                        >
                            {metaAnalysisStudyset?.neurostore_id || ''}
                        </Link>
                    }
                />

                <MetaAnalysisSummaryRow title="selection" value={selectionText}>
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
                </MetaAnalysisSummaryRow>
            </Box>

            <Box>
                <Typography sx={{ fontWeight: 'bold' }}>Algorithm</Typography>

                <MetaAnalysisSummaryRow
                    title="algorithm and optional arguments"
                    value={specification?.estimator?.type || ''}
                    caption={getEstimatorDescription(metaAnalysisSpecification?.type, specification?.estimator?.type)}
                >
                    <DynamicInputDisplay dynamicArg={(specification?.estimator?.args || {}) as IDynamicValueType} />
                </MetaAnalysisSummaryRow>

                {specification?.corrector?.type && (
                    <MetaAnalysisSummaryRow
                        title="corrector and optional arguments"
                        value={specification?.corrector?.type || ''}
                    >
                        <DynamicInputDisplay dynamicArg={(specification?.corrector?.args || {}) as IDynamicValueType} />
                    </MetaAnalysisSummaryRow>
                )}
            </Box>
        </Box>
    );
};

export default DisplayMetaAnalysisSpecification;
