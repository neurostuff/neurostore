import { indexToPRISMAMapping, IPRISMAConfig } from 'hooks/projects/useGetProjects';
import {
    useProjectCurationColumns,
    useProjectCurationExclusionTags,
    useProjectCurationImports,
    useProjectCurationPrismaConfig,
} from 'pages/Project/store/ProjectStore';
import { useEffect, useMemo, useState } from 'react';
import { IGroupListItem } from '../components/CurationBoardAIGroupsList';
import { ECurationBoardAIInterface } from '../components/CurationBoardAi';
import { SxProps } from '@mui/system';
import { defaultExclusionTags } from 'pages/Project/store/ProjectStore.types';

const excludedListItemStyles: SxProps = {
    '& .MuiListItemButton-root': {
        padding: '2px 16px',
    },
};

const excludedListItemStylesChildren: SxProps = {
    color: 'error.dark',
    '& .MuiListItemButton-root': {
        padding: '2px 16px',
    },
};

function useCurationBoardGroupsState() {
    const curationColumns = useProjectCurationColumns();
    const prismaConfig = useProjectCurationPrismaConfig();
    const [selectedGroup, setSelectedGroup] = useState<IGroupListItem>();
    const excludedGroups = useProjectCurationExclusionTags();
    const curationImports = useProjectCurationImports();

    useEffect(() => {
        return () => {
            console.log('cleaning up');
        };
    }, []);

    const groups: IGroupListItem[] = useMemo(() => {
        if (curationColumns.length === 0) return [];
        let groupListItems: IGroupListItem[] = [];

        const numTotalStudies = curationColumns.reduce((acc, curr) => acc + curr.stubStudies.length, 0);

        if (prismaConfig.isPrisma) {
            groupListItems.push({
                id: 'prisma_header',
                type: 'SUBHEADER',
                label: 'PRISMA Curation',
                count: numTotalStudies,
                UI: null,
            });

            curationColumns.forEach((column, index) => {
                groupListItems.push({
                    id: column.id,
                    type: 'LISTITEM',
                    label: `${index + 1}. ${column.name}`,
                    count: column.stubStudies.filter((x) => x.exclusionTag === null).length,
                    UI: ECurationBoardAIInterface.CURATOR,
                    children: [],
                });

                const prismaPhase: keyof Omit<IPRISMAConfig, 'isPrisma'> | undefined = indexToPRISMAMapping(index);

                if (prismaPhase === 'identification') {
                    groupListItems[groupListItems.length - 1].tooltipContent =
                        'Search for studies and identify duplicates';
                } else if (prismaPhase === 'screening') {
                    groupListItems[groupListItems.length - 1].tooltipContent =
                        'Screen titles and abstracts for relevance';
                } else if (prismaPhase === 'eligibility') {
                    groupListItems[groupListItems.length - 1].tooltipContent =
                        'Assess full full-texts against inclusion criteria';
                } else {
                    // inclusion phase
                    groupListItems[groupListItems.length - 1].tooltipContent =
                        'Studies to be included in the final meta-analysis';
                    return;
                }

                if (prismaPhase === 'identification') {
                    groupListItems.push({
                        id: defaultExclusionTags.duplicate.id,
                        type: 'LISTITEM',
                        label: defaultExclusionTags.duplicate.label,
                        count: column.stubStudies.filter(
                            (x) => x.exclusionTag?.id === defaultExclusionTags.duplicate.id
                        ).length,
                        UI: ECurationBoardAIInterface.EXCLUDE,
                        listItemStyles: {
                            '& .MuiListItemButton-root': {
                                padding: '2px 16px',
                            },
                            '& .MuiListItemText-root': {
                                padding: '2px 40px',
                                color: 'error.dark',
                            },
                        },
                        children: [],
                    });
                } else {
                    groupListItems.push({
                        id: `excluded_${column.id}`,
                        type: 'LISTITEM',
                        label: 'Excluded',
                        count: column.stubStudies.filter((x) => x.exclusionTag !== null).length,
                        UI: ECurationBoardAIInterface.EXCLUDE,
                        listItemStyles: excludedListItemStyles,
                        children: prismaConfig[prismaPhase].exclusionTags.map((exclusionTag) => ({
                            id: exclusionTag.id,
                            type: 'LISTITEM',
                            label: exclusionTag.label,
                            count: column.stubStudies.filter((x) => x.exclusionTag?.id === exclusionTag.id).length,
                            UI: ECurationBoardAIInterface.EXCLUDE,
                            listItemStyles: excludedListItemStylesChildren,
                            children: [],
                        })),
                    });
                }
            });

            groupListItems.push({
                id: 'divider',
                type: 'DIVIDER',
                label: '',
                count: null,
                UI: null,
            });
        } else {
            if (curationColumns.length !== 2)
                throw new Error(
                    'Expected 2 curation columns for a non prisma project, but got ' + curationColumns.length
                );
            const [unreviewedColumn, includedColumn] = curationColumns;

            groupListItems = [
                {
                    id: 'curate_header',
                    type: 'SUBHEADER',
                    label: 'Curation',
                    count: numTotalStudies,
                    UI: null,
                },
                {
                    id: unreviewedColumn.id,
                    type: 'LISTITEM',
                    label: unreviewedColumn.name,
                    count: unreviewedColumn.stubStudies.filter((x) => x.exclusionTag === null).length,
                    UI: ECurationBoardAIInterface.CURATOR,
                    children: [],
                },
                {
                    id: 'excluded_studies_column',
                    type: 'LISTITEM',
                    label: 'Excluded',
                    count: unreviewedColumn.stubStudies.filter((x) => x.exclusionTag !== null).length,
                    UI: ECurationBoardAIInterface.EXCLUDE,
                    listItemStyles: excludedListItemStyles,
                    children: excludedGroups.map((excludedGroup) => {
                        const numExcludedInGroup = curationColumns.reduce((acc, curr) => {
                            return (
                                acc +
                                curr.stubStudies.filter((study) => study.exclusionTag?.id === excludedGroup.id).length
                            );
                        }, 0);

                        return {
                            id: excludedGroup.id,
                            type: 'LISTITEM',
                            label: excludedGroup.label,
                            count: numExcludedInGroup,
                            UI: ECurationBoardAIInterface.EXCLUDE,
                            listItemStyles: excludedListItemStylesChildren,
                        } as IGroupListItem;
                    }),
                },
                {
                    id: includedColumn.id,
                    type: 'LISTITEM',
                    label: includedColumn.name,
                    count: includedColumn.stubStudies.filter((x) => x.exclusionTag === null).length,
                    UI: ECurationBoardAIInterface.CURATOR,
                    children: [],
                },
                {
                    id: 'divider-1',
                    type: 'DIVIDER',
                    label: '',
                    count: null,
                    UI: null,
                },
            ];
        }

        if (curationImports.length > 0) {
            groupListItems.push(
                {
                    id: 'imports_header',
                    type: 'SUBHEADER',
                    label: 'Imports',
                    count: null,
                    UI: null,
                },
                ...curationImports
                    .map((curationImport) => {
                        const date = new Date(curationImport.date);
                        return {
                            id: curationImport.id,
                            type: 'LISTITEM',
                            label: curationImport.name,
                            secondaryLabel: `${curationImport.importModeUsed}\n${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
                            count: curationImport.numImported,
                            UI: ECurationBoardAIInterface.IMPORT_SUMMARY,
                        } as IGroupListItem;
                    })
                    .reverse()
            );
        }

        return groupListItems;
    }, [curationColumns, curationImports, prismaConfig, excludedGroups]);

    useEffect(() => {
        if (selectedGroup === undefined && curationColumns.length > 0) {
            setSelectedGroup(groups[1]);
        }
    }, [groups, curationColumns.length, selectedGroup]);

    return {
        groups,
        selectedGroup,
        setSelectedGroup,
    };
}

export default useCurationBoardGroupsState;
