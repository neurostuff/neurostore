import { Typography } from '@mui/material';
import { CellContext } from '@tanstack/react-table';
import { getSearchResultRowNumber } from 'components/Search/search.helpers';
import { IExtractionTableStudy } from './ExtractionTable';

export const ExtractionTableIndexCell = ({ row, table }: CellContext<IExtractionTableStudy, unknown>) => {
    const { pageIndex, pageSize } = table.getState().pagination;
    const rowIndexOnPage = table.getRowModel().rows.findIndex((pageRow) => pageRow.id === row.id);
    const rowNumber = getSearchResultRowNumber(pageIndex + 1, pageSize, rowIndexOnPage);

    return <Typography variant="body2">{rowNumber}</Typography>;
};

export const ExtractionTableIndexHeader = () => {
    return <Typography variant="h6">#</Typography>;
};
