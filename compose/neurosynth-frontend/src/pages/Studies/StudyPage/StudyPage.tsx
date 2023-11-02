import DisplayStudy from 'components/DisplayStudy/DisplayStudy';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    useGetStudyIsLoading,
    useInitStudyStore,
    useStudyAnalyses,
    useStudyAuthors,
    useStudyDOI,
    useStudyDescription,
    useStudyName,
    useStudyPMID,
    useStudyPublication,
    useStudyStoreIsError,
} from '../StudyStore';

const StudyPage: React.FC = (props) => {
    const { studyId }: { studyId: string } = useParams<{
        studyId: string;
    }>();
    const initStudyStore = useInitStudyStore();
    const getStudyIsLoading = useGetStudyIsLoading();
    const isError = useStudyStoreIsError();
    const studyAnalyses = useStudyAnalyses();
    const studyName = useStudyName();
    const studyDescription = useStudyDescription();
    const studyDOI = useStudyDOI();
    const studyAuthors = useStudyAuthors();
    const studyPublication = useStudyPublication();
    const studyPMID = useStudyPMID();

    // init the study store with the url is given
    useEffect(() => {
        initStudyStore(studyId);
    }, [initStudyStore, studyId]);

    return (
        <StateHandlerComponent
            disableShrink={false}
            isLoading={getStudyIsLoading}
            isError={isError}
        >
            <DisplayStudy
                id={studyId}
                name={studyName}
                description={studyDescription}
                doi={studyDOI}
                pmid={studyPMID}
                authors={studyAuthors}
                publication={studyPublication}
                analyses={studyAnalyses}
            />
        </StateHandlerComponent>
    );
};

export default StudyPage;
