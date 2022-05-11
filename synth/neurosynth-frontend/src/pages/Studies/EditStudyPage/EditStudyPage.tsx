import { Box, Button } from '@mui/material';
import { useState, useEffect, useCallback } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { BackButton, EditAnalyses, EditStudyDetails, NeurosynthLoader } from '../../../components';
import EditStudyMetadata from '../../../components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import useIsMounted from '../../../hooks/useIsMounted';
import API, { AnalysisApiResponse } from '../../../utils/api';
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
    const isMountedRef = useIsMounted();
    // initial metadata received from the study is set in this state. Separate in order to avoid constant re renders
    const history = useHistory();
    const params: { studyId: string } = useParams();

    useEffect(() => {
        const getStudy = (id: string) => {
            API.NeurostoreServices.StudiesService.studiesIdGet(id, true)
                .then((res) => {
                    if (isMountedRef.current) {
                        const studyRes = res.data;

                        setStudy({
                            name: studyRes.name || '',
                            authors: studyRes.authors || '',
                            publication: studyRes.publication || '',
                            doi: studyRes.doi || '',
                            description: studyRes.description || '',
                            metadata: studyRes.metadata ? studyRes.metadata : {},
                            analyses: studyRes.analyses as AnalysisApiResponse[] | undefined,
                        });
                    }
                })
                .catch(() => {});
        };

        if (params.studyId) {
            getStudy(params.studyId);
        }
    }, [params.studyId, isMountedRef]);

    const handleAnalysisUpdate = (analysisId: string, newAnalysis: AnalysisApiResponse) => {
        setStudy((prevState) => {
            if (!prevState || !prevState.analyses) return prevState;
            const newAnalyses = [...prevState.analyses];
            const analysisIndexToUpdate = newAnalyses.findIndex(
                (analysis) => analysis.id === analysisId
            );

            if (analysisIndexToUpdate < 0) return { ...prevState };
            newAnalyses[analysisIndexToUpdate] = {
                ...newAnalyses[analysisIndexToUpdate],
                ...newAnalysis,
            };

            return {
                ...prevState,
                analyses: newAnalyses,
            };
        });
    };

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
        <NeurosynthLoader loaded={!!study}>
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
                        <EditAnalyses
                            onUpdateAnalysis={handleAnalysisUpdate}
                            analyses={study.analyses}
                        />
                    </Box>
                </>
            )}
        </NeurosynthLoader>
    );
};

export default EditStudyPage;
