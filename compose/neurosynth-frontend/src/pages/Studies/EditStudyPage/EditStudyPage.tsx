import { Box } from '@mui/material';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import BackButton from 'components/Buttons/BackButton/BackButton';
import EditAnalyses from 'components/EditStudyComponents/EditAnalyses/EditAnalyses';
import EditStudyDetails from 'components/EditStudyComponents/EditStudyDetails/EditStudyDetails';
import EditStudyMetadata from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudyById } from 'hooks';
import { AnalysisApiResponse } from 'utils/api';
import EditStudyPageStyles from './EditStudyPage.styles';

interface IStudyEdit {
    name: string;
    authors: string;
    publication: string;
    doi: string;
    description: string;
    metadata: any | undefined;
    analyses: AnalysisApiResponse[] | undefined;
}

const EditStudyPage = () => {
    // study and metadata edits are updated and stored in this state
    const [study, setStudy] = useState<IStudyEdit | undefined>(undefined);
    const params: { studyId: string } = useParams();
    const { isLoading, data, isError } = useGetStudyById(params.studyId || '');

    useEffect(() => {
        if (data) {
            setStudy({
                name: data.name || '',
                authors: data.authors || '',
                publication: data.publication || '',
                doi: data.doi || '',
                description: data.description || '',
                metadata: data.metadata ? data.metadata : {},
                analyses: data.analyses as AnalysisApiResponse[] | undefined,
            });
        }
    }, [data]);

    const handleUpdateStudyMetadata = useCallback((updatedMetadata: any) => {
        setStudy((prevState) => {
            if (!prevState) return undefined;
            return {
                ...prevState,
                metadata: updatedMetadata,
            };
        });
    }, []);

    return (
        <StateHandlerComponent isLoading={isLoading} isError={isError}>
            <Box sx={EditStudyPageStyles.stickyButtonContainer}>
                <BackButton
                    sx={EditStudyPageStyles.button}
                    text="return to study view"
                    path={`/studies/${params.studyId}`}
                />
            </Box>

            {study && (
                <>
                    <Box sx={{ marginBottom: '15px', padding: '0 10px' }}>
                        <EditStudyDetails
                            studyId={params.studyId}
                            name={study.name}
                            description={study.description}
                            authors={study.authors}
                            doi={study.doi}
                            publication={study.publication}
                        />
                    </Box>

                    <Box sx={{ marginBottom: '15px', padding: '0 10px' }}>
                        <EditStudyMetadata
                            onUpdateStudyMetadata={handleUpdateStudyMetadata}
                            metadata={study.metadata}
                            studyId={params.studyId}
                        />
                    </Box>

                    <Box sx={{ marginBottom: '15px', padding: '0 10px', marginLeft: '15px' }}>
                        <EditAnalyses analyses={study.analyses} />
                    </Box>
                </>
            )}
        </StateHandlerComponent>
    );
};

export default EditStudyPage;
