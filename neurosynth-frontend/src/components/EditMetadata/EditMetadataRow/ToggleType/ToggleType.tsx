import { FormControl, MenuItem, Select } from '@material-ui/core';
import React from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import ToggleTypeStyles from './ToggleTypeStyles';

interface ToggleTypeModel {
    onToggle: (type: PropertyType) => void;
    type: PropertyType;
}

export enum PropertyType {
    OTHER = 'other',
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
}

const ToggleType: React.FC<ToggleTypeModel> = React.memo((props) => {
    const classes = ToggleTypeStyles();
    const [type, setType] = useState<PropertyType>(props.type);

    useEffect(() => {
        setType(props.type);
    }, [props.type]);

    const handleSetType = (
        event: React.ChangeEvent<{
            name?: string | undefined;
            value: unknown;
        }>,
        child: React.ReactNode,
    ) => {
        const selected = event.target.value as PropertyType;
        setType(selected);
        props.onToggle(selected);
    };

    const myClass: 'type_number' | 'type_boolean' | 'type_string' | 'type_other' = `type_${type}`;

    return (
        <div className={classes.toggleItemContainer}>
            <FormControl variant="outlined">
                <Select className={`${classes[myClass]} ${classes.toggle_item}`} value={type} onChange={handleSetType}>
                    <MenuItem className={classes.type_string} value="string">
                        STRING
                    </MenuItem>
                    <MenuItem className={classes.type_number} value="number">
                        NUMBER
                    </MenuItem>
                    <MenuItem className={classes.type_boolean} value="boolean">
                        BOOLEAN
                    </MenuItem>
                    <MenuItem className={classes.type_other} value="other">
                        NONE
                    </MenuItem>
                </Select>
            </FormControl>
        </div>
    );
});

export default ToggleType;
