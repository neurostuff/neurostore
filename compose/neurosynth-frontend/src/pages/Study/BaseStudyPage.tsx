import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import Study from 'pages/Study/components/Study';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { selectBestBaseStudyVersion } from 'helpers/Extraction.helpers';
import useGetBaseStudyNestedById from 'hooks/studies/useGetBaseStudyNestedById';
import studyQueries from 'hooks/studies/studyQueries';
import { AnalysisReturn, StudyReturn } from 'neurostore-typescript-sdk';
import { SearchDataType } from 'pages/Study/Study.types';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { studyAnalysesToStoreAnalyses } from 'stores/study/StudyStore.helpers';
import { useInitStudyStore } from 'stores/study/StudyStore';
import { lastUpdatedAtSortFn } from 'helpers/utils';

const formatVersionDate = (dateValue: string | null | undefined): string | undefined => {
    if (!dateValue) return undefined;
    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) return undefined;
    return parsedDate.toLocaleString();
};

const getVersionTypeLabel = (version: StudyReturn): string => {
    if (version.has_images) return 'Images';
    if (version.has_coordinates) return 'Coordinates';
    return 'Coordinates';
};

const BaseStudyPage = () => {
    const navigate = useNavigate();
    const initStudyStore = useInitStudyStore();
    const [searchParams] = useSearchParams();
    const dataTypeParam = searchParams.get('dataType');
    const preferredType =
        dataTypeParam === SearchDataType.IMAGE || dataTypeParam === SearchDataType.COORDINATE
            ? dataTypeParam
            : undefined;

    const { baseStudyId, studyVersionId } = useParams<{
        baseStudyId: string;
        studyVersionId?: string;
    }>();
    const {
        data: baseStudy,
        isLoading: baseStudyIsLoading,
        isError: baseStudyIsError,
    } = useGetBaseStudyNestedById(baseStudyId);

    // if studyVersionId doesnt exist, then it will not be queried.
    // In the second useEffect hook below, we keep trying to set the studyVersionId
    const {
        data: study,
        isLoading: studyIsLoading,
        isError: studyIsError,
    } = useQuery(studyQueries.studies.byIdNested(studyVersionId));

    // init the study store with the given version when a new one is set
    useEffect(() => {
        // if theres no study, that means it probably doesnt exist or there was an error retrieving. We dont want to
        // init the study store as it will make a request that will return an error
        if (!study) return;
        initStudyStore(studyVersionId);
    }, [initStudyStore, study, studyVersionId]);

    // on initial load, we keep trying to set the URL with the study version until one is set
    useEffect(() => {
        if (baseStudy && baseStudy.versions && baseStudy.versions.length > 0 && !studyVersionId) {
            const versions = baseStudy.versions as StudyReturn[];
            const bestVersion = selectBestBaseStudyVersion(versions, preferredType);
            if (!bestVersion?.id) return;

            const nextSearch = searchParams.toString();
            navigate(`/base-studies/${baseStudyId}/${bestVersion.id}${nextSearch ? `?${nextSearch}` : ''}`, {
                replace: true,
            });
        }
    }, [baseStudy, baseStudyId, navigate, preferredType, searchParams, studyVersionId]);

    const analyses = studyAnalysesToStoreAnalyses((study?.analyses || []) as Array<AnalysisReturn>);
    const sortedVersions = useMemo(() => {
        return [...(baseStudy?.versions ?? [])].sort(lastUpdatedAtSortFn);
    }, [baseStudy?.versions]);
    const selectedVersion = sortedVersions.find((version) => version.id === studyVersionId);

    console.log({ sortedVersions });

    return (
        <StateHandlerComponent
            disableShrink={false}
            isLoading={baseStudyIsLoading || studyIsLoading}
            isError={baseStudyIsError || studyIsError}
        >
            <Box sx={{ margin: '1rem 0', display: 'flex', alignItems: 'center' }}>
                <FormControl size="small" sx={{ width: '500px' }}>
                    <InputLabel>Select version to view</InputLabel>
                    <Select
                        onChange={(event) => {
                            const selectedVersionId = event.target.value;
                            const nextSearch = searchParams.toString();
                            navigate(
                                `/base-studies/${baseStudyId}/${selectedVersionId}${nextSearch ? `?${nextSearch}` : ''}`
                            );
                        }}
                        value={studyVersionId || ''}
                        label="Select version to view"
                        renderValue={() => {
                            if (!selectedVersion) return '';
                            const typeLabel = getVersionTypeLabel(selectedVersion);
                            const displayDate = selectedVersion.updated_at
                                ? formatVersionDate(selectedVersion.updated_at)
                                : formatVersionDate(selectedVersion.created_at);
                            const displayDateText = selectedVersion.updated_at ? 'Updated' : 'Created';
                            const user = selectedVersion.username ?? selectedVersion.user ?? 'neurosynth';
                            return `${typeLabel} · ${user} · ${displayDateText}: ${displayDate}`;
                        }}
                    >
                        {sortedVersions.map((version, index) => {
                            const typeLabel = getVersionTypeLabel(version);
                            const owner = version.username ? version.username : 'neurosynth';
                            const updatedAt = formatVersionDate(version.updated_at);
                            const createdAt = formatVersionDate(version.created_at);

                            return (
                                <MenuItem key={version.id || index} value={version.id} sx={{ py: 1.25 }}>
                                    <Box sx={{ width: '100%' }}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'baseline',
                                                justifyContent: 'space-between',
                                                gap: 2,
                                                width: '100%',
                                            }}
                                        >
                                            <Typography fontWeight="bold">{typeLabel}</Typography>
                                            {updatedAt && (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ flexShrink: 0 }}
                                                >
                                                    Last updated: {updatedAt}
                                                </Typography>
                                            )}
                                        </Box>
                                        <Typography variant="body2" color="text.secondary">
                                            Owner: {owner}
                                        </Typography>
                                        {createdAt && (
                                            <Typography variant="body2" color="text.secondary">
                                                Created: {createdAt}
                                            </Typography>
                                        )}
                                    </Box>
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>
            </Box>
            <Study
                id={study?.id}
                name={baseStudy?.name}
                description={baseStudy?.description}
                doi={baseStudy?.doi}
                pmid={baseStudy?.pmid}
                authors={baseStudy?.authors}
                publication={baseStudy?.publication}
                analyses={analyses}
                has_images={study?.has_images}
                has_coordinates={study?.has_coordinates}
            />
        </StateHandlerComponent>
    );
};

export default BaseStudyPage;
