import React from 'react';
import { useHistory } from 'react-router';
import { DisplayValuesTable } from '../..';
import { StudysetsApiResponse } from '../../../utils/api';
import { IDisplayValuesTableModel } from '../DisplayValuesTable';

export interface IStudysetsTable {
    studysets: StudysetsApiResponse[];
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

const StudysetsTable: React.FC<IStudysetsTable> = (props) => {
    const history = useHistory();

    const handleRowClick = (id: string | number) => {
        history.push(`/studysets/${id}`);
    };

    const dataForStudysetsTable: IDisplayValuesTableModel = {
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
        rowData: props.studysets.map((studyset, index) => ({
            uniqueKey: studyset.id || index,
            columnValues: [
                {
                    value: studyset.name ?? 'No name',
                    shouldHighlightNoData: !studyset.name,
                },
                {
                    value: getNumStudiesString(studyset.studies),
                    shouldHighlightNoData: getNumStudiesString(studyset.studies) === '0 studies',
                },
                {
                    value: studyset.description ?? 'No description',
                    shouldHighlightNoData: !studyset.description,
                },
            ],
        })),
    };

    return <DisplayValuesTable {...dataForStudysetsTable} />;
};

export default StudysetsTable;
