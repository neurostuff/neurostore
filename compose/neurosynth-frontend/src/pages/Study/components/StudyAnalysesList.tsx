import { List } from '@mui/material';
import StudyAnalysesListItem from 'pages/Study/components/StudyAnalysesListItem';
import { IStoreAnalysis } from 'stores/study/StudyStore.helpers';

const StudyAnalysesList = (props: {
    analyses: IStoreAnalysis[];
    selectedId: string | undefined;
    onSelectAnalysisIndex: (id: string) => void;
}) => {
    return (
        <List
            sx={{
                height: '100%',
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
            }}
            disablePadding
        >
            {props.analyses.map((analysis) => (
                <StudyAnalysesListItem
                    key={analysis.id}
                    analysis={analysis}
                    selected={(props.selectedId || undefined) === (analysis.id || null)}
                    onSelectAnalysis={(id) => props.onSelectAnalysisIndex(id)}
                />
            ))}
        </List>
    );
};

export default StudyAnalysesList;
