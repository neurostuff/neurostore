import { FormControl, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import React, { ReactNode } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { EPropertyType, IToggleTypeModel } from '../..';
import ToggleTypeStyles from './ToggleTypeStyles';

const ToggleType: React.FC<IToggleTypeModel> = React.memo((props) => {
    const classes = ToggleTypeStyles();
    const [type, setType] = useState<EPropertyType>(props.type);

    useEffect(() => {
        setType(props.type);
    }, [props.type]);

    const handleSetType = (event: SelectChangeEvent<EPropertyType>, child: ReactNode) => {
        const selected = event.target.value as EPropertyType;
        setType(selected);
        props.onToggle(selected);
    };

    const myClass: 'type_number' | 'type_boolean' | 'type_string' | 'type_none' = `type_${type}`;

    return (
        <div className={classes.toggleItemContainer}>
            <FormControl variant="outlined">
                <Select
                    className={`${classes[myClass]} ${classes.toggle_item}`}
                    value={type}
                    onChange={handleSetType}
                >
                    <MenuItem className={classes.type_string} value="string">
                        STRING
                    </MenuItem>
                    <MenuItem className={classes.type_number} value="number">
                        NUMBER
                    </MenuItem>
                    <MenuItem className={classes.type_boolean} value="boolean">
                        BOOLEAN
                    </MenuItem>
                    <MenuItem className={classes.type_none} value="none">
                        NONE
                    </MenuItem>
                </Select>
            </FormControl>
        </div>
    );
});

export default ToggleType;
