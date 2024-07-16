import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudyById } from 'hooks';
import { AnalysisReturn } from 'neurostore-typescript-sdk';
import Study from 'pages/Study/components/Study';
import { useInitStudyStore } from 'pages/Study/store/StudyStore';
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { studyAnalysesToStoreAnalyses } from './store/StudyStore.helpers';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import { Box } from '@mui/material';
import {
    useGetProjectIsLoading,
    useInitProjectStoreIfRequired,
    useProjectName,
} from 'pages/Project/store/ProjectStore';
import EditStudyToolbar from './components/EditStudyToolbar';

const ProjectPage: React.FC = (props) => {
    const initStudyStore = useInitStudyStore();
    useInitProjectStoreIfRequired();

    const getProjectIsLoading = useGetProjectIsLoading();
    const projectName = useProjectName();

    const { projectId, studyId } = useParams<{
        projectId?: string;
        studyId?: string;
    }>();

    // if studyVersionId doesnt exist, then it will not be queried.
    // In the second useEffect hook below, we keep trying to set the studyVersionId
    const {
        data: study,
        isLoading: studyIsLoading,
        isError: studyIsError,
    } = useGetStudyById(studyId || '');

    // init the study store with the given version when a new one is set
    useEffect(() => {
        // if theres no study, that means it probably doesnt exist or there was an error retrieving. We dont want to
        // init the study store as it will make a request that will return an error
        if (!study) return;
        initStudyStore(studyId);
    }, [initStudyStore, studyId, study]);

    const analyses = studyAnalysesToStoreAnalyses((study?.analyses || []) as Array<AnalysisReturn>);
    return (
        <StateHandlerComponent
            disableShrink={false}
            isLoading={studyIsLoading || getProjectIsLoading}
            isError={studyIsError}
        >
            <EditStudyToolbar isViewOnly />
            <Box mb="1rem">
                <NeurosynthBreadcrumbs
                    breadcrumbItems={[
                        {
                            text: 'Projects',
                            link: '/projects',
                            isCurrentPage: false,
                        },
                        {
                            text: projectName || '',
                            link: `/projects/${projectId}`,
                            isCurrentPage: false,
                        },
                        {
                            text: 'Extraction',
                            link: `/projects/${projectId}/extraction`,
                            isCurrentPage: false,
                        },
                        {
                            text: study?.name || '',
                            link: `/projects/${projectId}/extraction/studies/${studyId}/edit`,
                            isCurrentPage: true,
                        },
                    ]}
                />
            </Box>
            <Study
                id={study?.id}
                name={study?.name}
                description={study?.description}
                doi={study?.doi}
                pmid={study?.pmid}
                authors={study?.authors}
                publication={study?.publication}
                analyses={analyses}
            />
        </StateHandlerComponent>
    );
};

export default ProjectPage;
