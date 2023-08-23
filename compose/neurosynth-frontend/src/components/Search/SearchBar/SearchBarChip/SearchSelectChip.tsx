import { ArrowDropDown } from '@mui/icons-material';
import { Box, Chip, MenuItem, MenuList } from '@mui/material';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import { useRef, useState } from 'react';

interface ISearchSelectChip<T> {
    chipLabel: string;
    onSelectSearch: (searchParams: T) => void;
    options: {
        value: T;
        label: string;
    }[];
}

const SearchSelectChip = <T extends string>(props: ISearchSelectChip<T>) => {
    const { chipLabel, onSelectSearch, options } = props;

    const dataTypeSelectRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);

    const onSelect = (value: T) => {
        setIsOpen(false);
        onSelectSearch(value);
    };

    return (
        <>
            <NeurosynthPopper
                anchorElement={dataTypeSelectRef?.current}
                onClickAway={() => setIsOpen(false)}
                open={isOpen}
            >
                <Box sx={{ width: '220px' }}>
                    <MenuList>
                        {options.map((option) => (
                            <MenuItem
                                onClick={() => onSelect(option.value)}
                                key={option.label}
                                value={option.value}
                            >
                                {option.label}
                            </MenuItem>
                        ))}
                    </MenuList>
                </Box>
            </NeurosynthPopper>
            <Chip
                ref={dataTypeSelectRef}
                color="primary"
                variant="outlined"
                clickable
                onClick={() => setIsOpen(true)}
                icon={<ArrowDropDown />}
                sx={{ marginLeft: '5px', width: '220px' }}
                label={chipLabel}
            />
        </>
    );
};

export default SearchSelectChip;
