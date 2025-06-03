import { Box, Chip, Divider, List, ListSubheader, SxProps, Tooltip } from '@mui/material';
import React from 'react';
import { ECurationBoardAIInterface } from './CurationBoardAi';
import CurationBoardAIGroupsStyles from './CurationBoardAIGroups.styles';
import CurationBoardAIGroupsListItem from './CurationBoardAIGroupsListItem';

export enum ICurationGroupId {
    UNCATEGORIZED = 'uncategorized',
    NEEDS_REVIEW = 'needs_review',
    INCLUDED = 'included',
}

export interface IGroupListItem {
    type: 'LISTITEM' | 'SUBHEADER' | 'DIVIDER';
    id: string | ICurationGroupId;
    label: string;
    secondaryLabel?: string;
    count: number | null;
    UI: ECurationBoardAIInterface | null;
    children?: IGroupListItem[];
    listItemStyles?: SxProps;
    tooltipContent?: string | React.ReactNode;
}

const CurationBoardAIGroupsList: React.FC<{
    selectedGroup: IGroupListItem | undefined;
    groups: IGroupListItem[];
    onSelectGroup: (selectedInterface: IGroupListItem) => void;
}> = ({ selectedGroup, onSelectGroup, groups }) => {
    const handleSelectGroup = (group: IGroupListItem) => {
        onSelectGroup(group);
    };

    return (
        <List
            disablePadding
            sx={{
                height: '100%',
                overflowY: 'auto',
                direction: 'rtl',
                scrollbarColor: '#c1c1c1 rgb(242, 242, 242)',
            }}
        >
            <Box sx={{ direction: 'ltr' }}>
                {groups.map((group) => (
                    <React.Fragment key={group.id}>
                        {group.type === 'LISTITEM' ? (
                            <CurationBoardAIGroupsListItem
                                group={group}
                                selectedGroupId={selectedGroup?.id}
                                handleSelectGroup={handleSelectGroup}
                            />
                        ) : group.type === 'SUBHEADER' ? (
                            <ListSubheader sx={CurationBoardAIGroupsStyles.listSubheader}>
                                {group.label}
                                {group.count !== null && <Chip label={group.count} size="small" />}
                            </ListSubheader>
                        ) : (
                            <Box m="1rem">
                                <Divider />
                            </Box>
                        )}
                    </React.Fragment>
                ))}
            </Box>
        </List>
    );
};

export default CurationBoardAIGroupsList;
