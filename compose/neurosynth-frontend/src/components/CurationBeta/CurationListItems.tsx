import {
    Box,
    Chip,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ListSubheader,
} from '@mui/material';
import React, { Fragment, useState } from 'react';
import CurationListItemsStyles from './CurationListItems.styles';

export interface ICurationListItem {
    id: string;
    type: 'listItem' | 'header';
    label: string;
    number: number | undefined;
    listItemButtonContents?: React.ReactNode;
}

const CurationListItems: React.FC<{
    listItems: ICurationListItem[];
    selectedListItemId: string;
    onSelectListItem: (id: string) => void;
}> = (props) => {
    return (
        <Box>
            <List disablePadding>
                {props.listItems.map((listItem) => (
                    <Fragment key={listItem.id}>
                        {listItem.type === 'header' ? (
                            <ListSubheader sx={CurationListItemsStyles.listSubheader}>
                                {listItem.label}
                            </ListSubheader>
                        ) : (
                            <ListItem
                                onClick={() => props.onSelectListItem(listItem.id)}
                                sx={CurationListItemsStyles.listItem}
                                disablePadding
                            >
                                <ListItemButton
                                    sx={CurationListItemsStyles.listItemButton}
                                    selected={listItem.id === props.selectedListItemId}
                                >
                                    {listItem.listItemButtonContents || (
                                        <>
                                            <ListItemText primary={listItem.label} />
                                            <Chip label={listItem.number} />
                                        </>
                                    )}
                                </ListItemButton>
                            </ListItem>
                        )}
                    </Fragment>
                ))}
            </List>
        </Box>
    );
};

export default CurationListItems;
