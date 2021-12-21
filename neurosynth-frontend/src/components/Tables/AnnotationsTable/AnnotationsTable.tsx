import { DisplayValuesTable } from '../..';
import { AnnotationsApiResponse } from '../../../utils/api';
import { IDisplayValuesTableModel } from '../DisplayValuesTable';

const AnnotationsTable: React.FC<{ annotations: AnnotationsApiResponse[] }> = (props) => {
    const dataForAnnotationsTable: IDisplayValuesTableModel = {
        columnHeaders: [
            { value: 'Name', bold: true },
            { value: 'Description', bold: true },
        ],
        tableHeadRowColor: '#b4656f',
        tableHeadRowTextContrastColor: 'white',
        paper: true,
        rowData: props.annotations.map((annotation) => ({
            uniqueKey: annotation.id as string,
            columnValues: [{ value: annotation.name }, { value: annotation.description }],
        })),
    };

    return <DisplayValuesTable {...dataForAnnotationsTable} />;
};

export default AnnotationsTable;
