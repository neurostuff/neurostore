import { DisplayValuesTable } from '../..';
import { AnnotationsApiResponse } from '../../../utils/api';
import { IDisplayValuesTableModel } from '../DisplayValuesTable';
import { useHistory } from 'react-router';
import { useAuth0 } from '@auth0/auth0-react';

const AnnotationsTable: React.FC<{ annotations: AnnotationsApiResponse[]; studysetId: string }> = (
    props
) => {
    const history = useHistory();
    const { user } = useAuth0();

    const handleRowClick = (id: string | number) => {
        history.push(`/studysets/${props.studysetId}/annotations/${id}`);
    };

    const dataForAnnotationsTable: IDisplayValuesTableModel = {
        columnHeaders: [
            { value: 'Name', bold: true },
            { value: 'Description', bold: true },
            { value: 'Owner', bold: true },
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
                {
                    value: annotation.user
                        ? annotation.user === user?.sub
                            ? 'Me'
                            : annotation.user
                        : 'Neurosynth',
                },
            ],
        })),
    };

    return <DisplayValuesTable {...dataForAnnotationsTable} />;
};

export default AnnotationsTable;
