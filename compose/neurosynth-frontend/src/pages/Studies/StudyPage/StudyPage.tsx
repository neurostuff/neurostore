import DisplayStudy from 'components/DisplayStudy/DisplayStudy';
import { metadataToArray } from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetBaseStudyById from 'hooks/studies/useGetBaseStudyById';
import React from 'react';
import { useParams } from 'react-router-dom';

const StudyPage: React.FC = (props) => {
    const { studyId } = useParams<{ studyId: string }>();
    const { data, isLoading, isError } = useGetBaseStudyById(studyId);

    const metadataArr = metadataToArray(data?.metadata);

    return (
        <StateHandlerComponent isLoading={isLoading} isError={isError}>
            <DisplayStudy
                name={data?.name}
                description={data?.description}
                doi={data?.doi}
                pmid={data?.pmid}
                authors={data?.authors}
                publication={data?.publication}
                metadata={metadataArr}
                analyses={[]}
            />
        </StateHandlerComponent>
    );
};

export default StudyPage;
