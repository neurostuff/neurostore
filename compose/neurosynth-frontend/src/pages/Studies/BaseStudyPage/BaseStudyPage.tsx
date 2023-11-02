import { Box, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import DisplayStudy from 'components/DisplayStudy/DisplayStudy';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudyById } from 'hooks';
import useGetBaseStudyById from 'hooks/studies/useGetBaseStudyById';
import { AnalysisReturn, StudyReturn } from 'neurostore-typescript-sdk';
import React, { useEffect } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useInitStudyStore } from '../StudyStore';
import { studyAnalysesToStoreAnalyses } from '../StudyStore.helpers';

const BaseStudyPage: React.FC = (props) => {
    const history = useHistory();
    const initStudyStore = useInitStudyStore();

    const { baseStudyId, studyVersionId }: { baseStudyId: string; studyVersionId?: string } =
        useParams<{
            baseStudyId: string;
            studyVersionId?: string;
        }>();
    const {
        data: baseStudy,
        isLoading: baseStudyIsLoading,
        isError: baseStudyIsError,
    } = useGetBaseStudyById(baseStudyId);

    // if studyVersionId doesnt exist, then it will not be queried.
    // In the second useEffect hook below, we keep trying to set the studyVersionId
    const {
        data: study,
        isLoading: studyIsLoading,
        isError: studyIsError,
    } = useGetStudyById(studyVersionId || '');

    // init the study store with the given version when a new one is set
    useEffect(() => {
        initStudyStore(studyVersionId);
    }, [initStudyStore, studyVersionId]);

    // on initial load, we keep trying to set the URL with the study version until one is set
    useEffect(() => {
        if (baseStudy && baseStudy.versions && baseStudy.versions.length > 0 && !studyVersionId) {
            history.replace(
                `/base-studies/${baseStudyId}/${(baseStudy.versions as StudyReturn[])[0].id}`
            );
        }
    }, [baseStudy, baseStudyId, history, studyVersionId]);

    const analyses = studyAnalysesToStoreAnalyses((study?.analyses || []) as Array<AnalysisReturn>);
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
                            history.push(`/base-studies/${baseStudyId}/${selectedVersionId}`);
                        }}
                        value={studyVersionId || ''}
                        label="Select version to view"
                    >
                        {((baseStudy?.versions || []) as StudyReturn[]).map((version, index) => {
                            // we want the date last "touched", prefer updated_at over created_at
                            const parsedDate = new Date(
                                version?.updated_at || version?.created_at || ''
                            );

                            const dateStr = `${
                                parsedDate.getMonth() + 1
                            }/${parsedDate.getDate()}/${parsedDate.getFullYear()} ${parsedDate.getHours()}:${parsedDate.getMinutes()}`;

                            return (
                                <MenuItem key={version.id || index} value={version.id}>
                                    Last updated: {dateStr} | Owner:{' '}
                                    {version?.username ? version.username : 'neurosynth'}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>
            </Box>
            <DisplayStudy
                id={study?.id}
                name={baseStudy?.name}
                description={baseStudy?.description}
                doi={baseStudy?.doi}
                pmid={baseStudy?.pmid}
                authors={baseStudy?.authors}
                publication={baseStudy?.publication}
                analyses={analyses}
            />
        </StateHandlerComponent>
    );
};

export default BaseStudyPage;
