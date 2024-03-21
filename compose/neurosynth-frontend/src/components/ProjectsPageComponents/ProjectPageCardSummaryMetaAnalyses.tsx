import { useGetMetaAnalysesByIds } from 'hooks';

const ProjectPageCardSummaryMetaAnalyses: React.FC<{ metaAnalysisIds: string[] }> = (props) => {
    const { data: metaAnalyses, isError } = useGetMetaAnalysesByIds(
        props.metaAnalysisIds as string[]
    );
    return <>ProjectPageCardSummaryMetaAnalyses.tsx</>;
};

export default ProjectPageCardSummaryMetaAnalyses;
