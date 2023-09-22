import DisplayStudy from 'components/DisplayStudy/DisplayStudy';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudyById } from 'hooks';
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    useInitStudyStore,
    useStudyAnalyses,
    useStudyAuthors,
    useStudyDOI,
    useStudyDescription,
    useStudyIsLoading,
    useStudyName,
    useStudyPMID,
    useStudyPublication,
} from '../StudyStore';

const StudyPage: React.FC = (props) => {
    const { studyId }: { studyId: string } = useParams<{
        studyId: string;
    }>();
    const initStudyStore = useInitStudyStore();
    const studyStoreIsLoading = useStudyIsLoading();
    const studyAnalyses = useStudyAnalyses();
    const studyName = useStudyName();
    const studyDescription = useStudyDescription();
    const studyDOI = useStudyDOI();
    const studyAuthors = useStudyAuthors();
    const studyPublication = useStudyPublication();
    const studyPMID = useStudyPMID();

    // just used for loading
    const { isLoading: studyIsLoading, isError: studyIsError } = useGetStudyById(studyId || '');

    // init the study store with the url is given
    useEffect(() => {
        initStudyStore(studyId);
    }, [initStudyStore, studyId]);

    return (
        <StateHandlerComponent
            disableShrink={false}
            isLoading={studyStoreIsLoading || studyIsLoading}
            isError={studyIsError}
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
