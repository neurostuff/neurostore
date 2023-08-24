import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import DisplayStudy from 'components/DisplayStudy/DisplayStudy';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudyById } from 'hooks';
import useGetBaseStudyById from 'hooks/studies/useGetBaseStudyById';
import { AnalysisReturn, StudyReturn } from 'neurostore-typescript-sdk';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { studyAnalysesToStoreAnalyses } from '../StudyStore.helpers';

const StudyPage: React.FC = (props) => {
    const [selectedVersion, setSelectedVersion] = useState<StudyReturn>(); // TODO: replace this type with one more precise

    const { studyId } = useParams<{ studyId: string }>();
    const {
        data: baseStudy,
        isLoading: baseStudyIsLoading,
        isError: baseStudyIsError,
    } = useGetBaseStudyById(studyId);
    const {
        data: study,
        isLoading: studyIsLoading,
        isError: studyIsError,
    } = useGetStudyById(selectedVersion?.id);

    useEffect(() => {
        if (!selectedVersion && baseStudy && baseStudy.versions && baseStudy.versions.length > 0) {
            setSelectedVersion((baseStudy.versions as StudyReturn[])[0]);
        }
    }, [selectedVersion, baseStudy?.versions, baseStudy]);

    const analyses = studyAnalysesToStoreAnalyses((study?.analyses || []) as Array<AnalysisReturn>);

    return (
        <StateHandlerComponent
            isLoading={baseStudyIsLoading || studyIsLoading}
            isError={baseStudyIsError || studyIsError}
        >
            <Box sx={{ margin: '1rem', display: 'flex', alignItems: 'center' }}>
                <FormControl size="small" sx={{ width: '350px' }}>
                    <InputLabel>Select version to view</InputLabel>
                    <Select
                        onChange={(event) => {
                            const selectedID = event.target.value;
                            const foundVersion = (
                                (baseStudy?.versions || []) as StudyReturn[]
                            ).find((x) => x.id === selectedID);
                            setSelectedVersion(foundVersion);
                        }}
                        value={selectedVersion?.id || ''}
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
                                    {dateStr} | {version?.user ? version.user : 'neurosynth'}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>
            </Box>
            <DisplayStudy
                id={study?.id}
                name={baseStudy?.name}
                description={
                    baseStudy?.description ||
                    'lorem ipsum dolor sit amet consectetur adipisicing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
                }
                doi={baseStudy?.doi}
                pmid={baseStudy?.pmid}
                authors={baseStudy?.authors}
                publication={baseStudy?.publication}
                analyses={analyses}
            />
        </StateHandlerComponent>
    );
};

export default StudyPage;
