import React from 'react';
import { useHistory } from 'react-router';
import DisplayValuesTable from 'components/Tables/DisplayValuesTable/DisplayValuesTable';
import { StudysetsApiResponse } from '../../../utils/api';
import { IDisplayValuesTableModel } from '../DisplayValuesTable';

export interface IStudysetsTable {
    studysets: StudysetsApiResponse[];
    tableSize?: 'small' | 'medium';
    isLoading?: boolean;
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
            { value: 'User', bold: true },
        ],
        isLoading: props.isLoading,
        tableHeadRowColor: '#42ab55',
        selectable: true,
        tableHeadRowTextContrastColor: 'white',
        onValueSelected: handleRowClick,
        paper: true,
        rowData: props.studysets.map((studyset, index) => ({
            uniqueKey: studyset.id || index,
            columnValues: [
                {
                    value: studyset.name ? studyset.name : 'No name',
                    shouldHighlightNoData: !studyset.name,
                },
                {
                    value: getNumStudiesString(studyset.studies),
                    shouldHighlightNoData: getNumStudiesString(studyset.studies) === '0 studies',
                    noWrap: true,
                },
                {
                    value: studyset.description ? studyset.description : 'No description',
                    shouldHighlightNoData: !studyset.description,
                    width: 40,
                    expandable: true,
                },
                {
                    value: studyset.user ? studyset.user : 'No user',
                    shouldHighlightNoData: !studyset.user,
                    noWrap: true,
                },
            ],
        })),
    };

    return <DisplayValuesTable {...dataForStudysetsTable} />;
};

export default StudysetsTable;
