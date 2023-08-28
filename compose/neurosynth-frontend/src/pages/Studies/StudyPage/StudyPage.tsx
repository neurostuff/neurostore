import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import DisplayStudy from 'components/DisplayStudy/DisplayStudy';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudyById } from 'hooks';
import useGetBaseStudyById from 'hooks/studies/useGetBaseStudyById';
import { AnalysisReturn } from 'neurostore-typescript-sdk';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { studyAnalysesToStoreAnalyses } from '../StudyStore.helpers';

const StudyPage: React.FC = (props) => {
    const [selectedVersion, setSelectedVersion] = useState<string>();

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
    } = useGetStudyById(selectedVersion);

    useEffect(() => {
        if (!selectedVersion && baseStudy?.versions) {
            setSelectedVersion(baseStudy.versions[0] as string);
        }
    }, [selectedVersion, baseStudy?.versions]);

    const analyses = studyAnalysesToStoreAnalyses((study?.analyses || []) as Array<AnalysisReturn>);

    return (
        <StateHandlerComponent
            isLoading={baseStudyIsLoading || studyIsLoading}
            isError={baseStudyIsError || studyIsError}
        >
            <Box sx={{ margin: '1rem 1rem 2rem 1rem', display: 'flex', alignItems: 'center' }}>
                <Typography sx={{ whiteSpace: 'nowrap', marginRight: '1rem' }}>
                    Viewing version <b>{selectedVersion}</b>:
                </Typography>
                <FormControl size="small" sx={{ width: '450px' }}>
                    <InputLabel>Version</InputLabel>
                    <Select
                        onChange={(event) => setSelectedVersion(event.target.value)}
                        value={selectedVersion || ''}
                        label="Version"
                    >
                        {((baseStudy?.versions || []) as string[]).map((version) => (
                            <MenuItem key={version} value={version}>
                                {version}
                            </MenuItem>
                        ))}
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

export default StudyPage;
