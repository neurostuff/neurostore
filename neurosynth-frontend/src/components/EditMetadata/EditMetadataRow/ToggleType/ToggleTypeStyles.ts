import { makeStyles } from '@material-ui/core';

const ToggleTypeStyles = makeStyles({
    type_string: {
        color: 'orange',
        '& fieldset': {
            borderColor: 'orange',
        },
        '&.Mui-focused > fieldset': {
            borderColor: 'orange !important',
        },
    },
    type_number: {
        color: 'blue',
        '& fieldset': {
            borderColor: 'blue',
        },
        '&.Mui-focused > fieldset': {
            borderColor: 'blue !important',
        },
    },
    type_boolean: {
        color: 'green',
        '& fieldset': {
            borderColor: 'green',
        },
        '&.Mui-focused > fieldset': {
            borderColor: 'green !important',
        },
    },
    type_other: {
        color: '#b5b5b5',
        '& fieldset': {
            borderColor: '#b5b5b5',
        },
        '&.Mui-focused > fieldset': {
            borderColor: '#b5b5b5 !important',
        },
    },
    toggle_item: {
        minWidth: '118px',
    },
    toggleItemContainer: {
        height: '100%',
        display: 'table-cell',
        verticalAlign: 'middle',
    },
});

export default ToggleTypeStyles;
