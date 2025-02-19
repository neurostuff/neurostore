import { Box, Chip, List, ListItem, ListItemButton, ListItemText, ListSubheader } from '@mui/material';
import { useProjectCurationColumns, useProjectCurationExclusionTags } from 'pages/Project/store/ProjectStore';
import { useEffect, useMemo } from 'react';
import { ECurationBoardAIInterface } from './CurationBoardAi';
import CurationBoardAIGroupsStyles from './CurationBoardAIGroups.styles';

export enum ICurationGroupId {
    UNCATEGORIZED = 'uncategorized',
    NEEDS_REVIEW = 'needs_review',
    INCLUDED = 'included',
}

export interface IGroupListItem {
    type: 'LISTITEM' | 'SUBHEADER';
    id: string | ICurationGroupId;
    label: string;
    count: number | null;
    UI: ECurationBoardAIInterface | null;
}

const CurationBoardAIGroupsList: React.FC<{
    selectedGroup: IGroupListItem | undefined;
    onSelectGroup: (selectedInterface: IGroupListItem) => void;
}> = ({ selectedGroup, onSelectGroup }) => {
    const excludedGroups = useProjectCurationExclusionTags();
    const curationColumns = useProjectCurationColumns();

    const GROUPS: IGroupListItem[] = useMemo(
        () => [
            ...curationColumns.map((curationColumn) => {
                return {
                    id: curationColumn.id,
                    type: 'LISTITEM',
                    label: curationColumn.name,
                    count: curationColumn.stubStudies.filter((x) => x.exclusionTag === null).length,
                    UI: ECurationBoardAIInterface.CURATOR,
                } as IGroupListItem;
            }),
            { id: 'excluded_studies_header', type: 'SUBHEADER', label: 'Excluded Studies', count: null, UI: null },
            ...excludedGroups.map((excludedGroup) => {
                const numExcludedInGroup = curationColumns.reduce((acc, curr) => {
                    return acc + curr.stubStudies.filter((study) => study.exclusionTag?.id === excludedGroup.id).length;
                }, 0);

                return {
                    id: excludedGroup.id,
                    type: 'LISTITEM',
                    label: excludedGroup.label,
                    count: numExcludedInGroup,
                    UI: ECurationBoardAIInterface.EXCLUDE,
                } as IGroupListItem;
            }),
            { id: 'imports_header', type: 'SUBHEADER', label: 'Imports', count: null, UI: null },
        ],
        [curationColumns, excludedGroups]
    );

    useEffect(() => {
        if (selectedGroup === undefined && curationColumns.length > 0) {
            onSelectGroup(GROUPS[0]);
        }
    }, [GROUPS, curationColumns.length, onSelectGroup, selectedGroup]);

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
                {GROUPS.map((group) => {
                    return group.type === 'LISTITEM' ? (
                        <ListItem
                            key={group.id}
                            disablePadding
                            disableGutters
                            sx={CurationBoardAIGroupsStyles.listItem}
                        >
                            <ListItemButton
                                onClick={() => handleSelectGroup(group)}
                                sx={CurationBoardAIGroupsStyles.listItemButton}
                                selected={selectedGroup?.id === group.id}
                            >
                                <ListItemText sx={{ textTransform: 'capitalize' }} primary={group.label} />
                                <Chip label={group.count} />
                            </ListItemButton>
                        </ListItem>
                    ) : (
                        <ListSubheader key={group.id} sx={CurationBoardAIGroupsStyles.listSubheader}>
                            {group.label}
                        </ListSubheader>
                    );
                })}
            </Box>
        </List>
    );
};

export default CurationBoardAIGroupsList;
