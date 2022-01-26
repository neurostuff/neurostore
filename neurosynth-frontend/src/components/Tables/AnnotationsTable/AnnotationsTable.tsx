import { DisplayValuesTable } from '../..';
import { AnnotationsApiResponse } from '../../../utils/api';
import { IDisplayValuesTableModel } from '../DisplayValuesTable';
import { useHistory } from 'react-router';

const AnnotationsTable: React.FC<{ annotations: AnnotationsApiResponse[]; datasetId: string }> = (
    props
) => {
    const history = useHistory();

    const handleRowClick = (id: string | number) => {
        history.push(`/datasets/${props.datasetId}/annotations/${id}`);
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
            columnValues: [{ value: annotation.name }, { value: annotation.description }],
        })),
    };

    return <DisplayValuesTable {...dataForAnnotationsTable} />;
};

export default AnnotationsTable;
