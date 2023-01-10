import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';
import { useCreateStudy } from 'hooks';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const MoveToExtractionIngestStep: React.FC = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const { mutateAsync, isLoading } = useCreateStudy();
    const [isIngesting, setIsIngesting] = useState(false);
    const { data } = useGetProjectById(projectId);

    useEffect(() => {
        if (data && !isIngesting) {
            const startIngestion = () => {
                if (
                    data?.provenance?.curationMetadata?.columns &&
                    data.provenance.curationMetadata.columns.length > 0
                ) {
                    const lastColumn =
                        data.provenance.curationMetadata.columns[
                            data.provenance.curationMetadata.columns.length - 1
                        ];

                    // const studiesToIngestList: ICurationStubStudy = lastColumn.stubStudies.map(
                    //     (stub) => mutateAsync()
                    // );
                }
            };

            startIngestion();
        }
    }, [data, isIngesting]);

    return <div>MoveToExtractionIngestStep</div>;
};

export default MoveToExtractionIngestStep;
