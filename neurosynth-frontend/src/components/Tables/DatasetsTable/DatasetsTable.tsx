import React from 'react';
import { useHistory } from 'react-router';
import { DisplayValuesTable } from '../..';
import { DatasetsApiResponse } from '../../../utils/api';
import { IDisplayValuesTableModel } from '../DisplayValuesTable';

export interface IDatasetsTable {
    datasets: DatasetsApiResponse[];
    tableSize?: 'small' | 'medium';
}

const getNumStudiesString = (studies: any[] | undefined): string => {
    if (!studies) {
        return '0 studies';
    } else if (studies.length === 1) {
        return '1 study';
    } else {
        return `${studies.length} studies`;
    }
};

const DatasetsTable: React.FC<IDatasetsTable> = (props) => {
    const history = useHistory();

    const handleRowClick = (id: string | number) => {
        history.push(`/datasets/${id}`);
    };

    const dataForDatasetsTable: IDisplayValuesTableModel = {
        columnHeaders: [
            { value: 'Name', bold: true },
            { value: '# of Studies', bold: true },
            { value: 'Description', bold: true },
        ],
        tableHeadRowColor: '#42ab55',
        selectable: true,
        tableHeadRowTextContrastColor: 'white',
        onValueSelected: handleRowClick,
        paper: true,
        rowData: props.datasets.map((dataset, index) => ({
            uniqueKey: dataset.id || index,
            columnValues: [
                {
                    value: !!dataset.name ? dataset.name : 'No name',
                    shouldHighlightNoData: !dataset.name,
                },
                {
                    value: getNumStudiesString(dataset.studies),
                    shouldHighlightNoData: getNumStudiesString(dataset.studies) === '0 studies',
                },
                {
                    value: !!dataset.description ? dataset.description : 'No description',
                    shouldHighlightNoData: !dataset.description,
                },
            ],
        })),
    };

    return <DisplayValuesTable {...dataForDatasetsTable} />;
};

export default DatasetsTable;
