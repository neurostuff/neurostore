import { ArrowDropDown } from '@mui/icons-material';
import { Chip, MenuItem, MenuList } from '@mui/material';
import { Box } from '@mui/system';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import { SortBy, SortByEnumToString } from 'pages/Studies/StudiesPage/models';
import { useMemo, useRef, useState } from 'react';

const SearchSelectSortChip: React.FC<{
    onSelectSort: (searchBy: SortBy) => void;
    onSelectDescOrder: (descOrder: boolean) => void;
    chipLabel: string;
    descOrderChipLabel: string;
    searchMode: 'study-search' | 'project-search';
}> = (props) => {
    const sortByRef = useRef(null);
    const descOrderRef = useRef(null);
    const [sortByPopperIsOpen, setSortByPopperIsOpen] = useState(false);
    const [descOrderPopperIsOpen, setDescOrderPopperIsOpen] = useState(false);

    const handleSelectSortBy = (sortBy: SortBy) => {
        props.onSelectSort(sortBy);
        setSortByPopperIsOpen(false);
    };

    const handleSelectIsDescOrder = (isDescOrder: boolean) => {
        props.onSelectDescOrder(isDescOrder);
        setDescOrderPopperIsOpen(false);
    };

    // get string values of the ENUM instead of the enum keys
    const sortByList = useMemo(() => {
        if (props.searchMode === 'study-search') {
            return Object.keys(SortBy).map((sortBy) => SortBy[sortBy as keyof typeof SortBy]);
        }

        return [SortBy.LASTUPDATED, SortBy.TITLE, SortBy.CREATEDAT, SortBy.DESCRIPTION];
    }, [props.searchMode]);

    return (
        <>
            <NeurosynthPopper
                anchorElement={sortByRef?.current}
                onClickAway={() => setSortByPopperIsOpen(false)}
                open={sortByPopperIsOpen}
            >
                <Box>
                    <MenuList sx={{ width: '160px' }}>
                        {sortByList.map((sortBy) => (
                            <MenuItem
                                onClick={() => handleSelectSortBy(sortBy as SortBy)}
                                key={sortBy}
                                value={sortBy}
                            >
                                {SortByEnumToString[sortBy]}
                            </MenuItem>
                        ))}
                    </MenuList>
                </Box>
            </NeurosynthPopper>
            <Chip
                ref={sortByRef}
                color="primary"
                variant="filled"
                clickable
                onClick={() => setSortByPopperIsOpen(true)}
                icon={<ArrowDropDown />}
                sx={{
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                    width: '170px',
                    marginLeft: '5px',
                }}
                label={props.chipLabel}
            />
            <NeurosynthPopper
                anchorElement={descOrderRef?.current}
                onClickAway={() => setDescOrderPopperIsOpen(false)}
                open={descOrderPopperIsOpen}
            >
                <Box>
                    <MenuList sx={{ width: '200px' }}>
                        <MenuItem onClick={() => handleSelectIsDescOrder(false)}>
                            Ascending Order
                        </MenuItem>
                        <MenuItem onClick={() => handleSelectIsDescOrder(true)}>
                            Descending Order
                        </MenuItem>
                    </MenuList>
                </Box>
            </NeurosynthPopper>
            <Chip
                ref={descOrderRef}
                color="primary"
                variant="filled"
                clickable
                onClick={() => setDescOrderPopperIsOpen(true)}
                icon={<ArrowDropDown />}
                sx={{
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    borderLeft: 0,
                    width: '80px',
                }}
                label={props.descOrderChipLabel}
            />
        </>
    );
};

export default SearchSelectSortChip;
