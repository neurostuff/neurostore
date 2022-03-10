import { DisplayValuesTable } from '../..';
import { AnnotationsApiResponse } from '../../../utils/api';
import { IDisplayValuesTableModel } from '../DisplayValuesTable';
import { useHistory } from 'react-router';

const AnnotationsTable: React.FC<{ annotations: AnnotationsApiResponse[]; studysetId: string }> = (
    props
) => {
    const history = useHistory();

    const handleRowClick = (id: string | number) => {
        history.push(`/studysets/${props.studysetId}/annotations/${id}`);
    };

    const dataForAnnotationsTable: IDisplayValuesTableModel = {
        columnHeaders: [
            { value: 'Name', bold: true },
            { value: 'Description', bold: true },
        ],
        tableHeadRowColor: '#b4656f',
        selectable: true,
        tableHeadRowTextContrastColor: 'white',
        onValueSelected: handleRowClick,
        paper: true,
        rowData: props.annotations.map((annotation) => ({
            uniqueKey: annotation.id as string,
            columnValues: [
                {
                    value: annotation.name ? annotation.name : 'No name',
                    shouldHighlightNoData: !annotation.name,
                },
                {
                    value: annotation.description ? annotation.description : 'No description',
                    shouldHighlightNoData: !annotation.description,
                },
            ],
        })),
    };

    return <DisplayValuesTable {...dataForAnnotationsTable} />;
};

export default AnnotationsTable;
