import { Search } from '@mui/icons-material';
import { Box, Checkbox, FormControlLabel, InputAdornment, TextField, Typography } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useMemo, useState } from 'react';
import { OnvocTreeNode } from 'pages/Explore/Explore.mockData';

type OnvocTreeFilterProps = {
    nodes: OnvocTreeNode[];
    selectedLeafIds: string[];
    onSelectedLeafIdsChange: (leafIds: string[]) => void;
    emphasize?: boolean;
};

type FilteredTreeResult = {
    nodes: OnvocTreeNode[];
    expandedIds: string[];
};

const filterOnvocTree = (nodes: OnvocTreeNode[], query: string): FilteredTreeResult => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return { nodes, expandedIds: [] };
    }

    const expandedIds: string[] = [];

    const filterNode = (node: OnvocTreeNode): OnvocTreeNode | null => {
        const labelMatches = node.label.toLowerCase().includes(normalizedQuery);
        const filteredChildren = (node.children ?? [])
            .map(filterNode)
            .filter((child): child is OnvocTreeNode => child !== null);

        if (labelMatches || filteredChildren.length > 0) {
            expandedIds.push(node.id);
            return {
                ...node,
                children: node.children ? filteredChildren : undefined,
            };
        }
        return null;
    };

    return {
        nodes: nodes.map(filterNode).filter((node): node is OnvocTreeNode => node !== null),
        expandedIds,
    };
};

const OnvocTreeFilter = ({
    nodes,
    selectedLeafIds,
    onSelectedLeafIdsChange,
    emphasize = false,
}: OnvocTreeFilterProps) => {
    const [treeFilterQuery, setTreeFilterQuery] = useState('');
    const [manualExpandedIds, setManualExpandedIds] = useState<string[]>(['cognition', 'emotion']);

    const { nodes: visibleNodes, expandedIds: filterExpandedIds } = useMemo(
        () => filterOnvocTree(nodes, treeFilterQuery),
        [nodes, treeFilterQuery]
    );

    const expandedItems = treeFilterQuery.trim() ? filterExpandedIds : manualExpandedIds;
    const selectedLeafIdSet = useMemo(() => new Set(selectedLeafIds), [selectedLeafIds]);

    const handleLeafToggle = (leafId: string, checked: boolean) => {
        if (checked) {
            onSelectedLeafIdsChange([...selectedLeafIds, leafId]);
        } else {
            onSelectedLeafIdsChange(selectedLeafIds.filter((id) => id !== leafId));
        }
    };

    const renderTreeItems = (treeNodes: OnvocTreeNode[]) =>
        treeNodes.map((node) => {
            const isLeaf = !node.children?.length;
            if (isLeaf) {
                return (
                    <TreeItem
                        key={node.id}
                        itemId={node.id}
                        label={
                            <FormControlLabel
                                onClick={(event) => event.stopPropagation()}
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={selectedLeafIdSet.has(node.id)}
                                        onChange={(event) => handleLeafToggle(node.id, event.target.checked)}
                                    />
                                }
                                label={<Typography variant="body2">{node.label}</Typography>}
                                sx={{ ml: 0, mr: 0 }}
                            />
                        }
                    />
                );
            }

            return (
                <TreeItem key={node.id} itemId={node.id} label={node.label}>
                    {renderTreeItems(node.children ?? [])}
                </TreeItem>
            );
        });

    return (
        <Box
            sx={{
                border: emphasize ? '2px solid' : '1px solid',
                borderColor: emphasize ? 'primary.main' : 'divider',
                borderRadius: 1,
                p: 1.5,
                backgroundColor: emphasize ? 'rgba(0, 119, 182, 0.04)' : 'background.paper',
            }}
        >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Disorders | Psychological Concepts | Population characteristics
            </Typography>
            <TextField
                size="small"
                fullWidth
                value={treeFilterQuery}
                onChange={(event) => setTreeFilterQuery(event.target.value)}
                placeholder="Filter vocabulary…"
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <Search fontSize="small" />
                        </InputAdornment>
                    ),
                }}
                sx={{ mb: 1 }}
            />
            {selectedLeafIds.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {selectedLeafIds.length} term{selectedLeafIds.length === 1 ? '' : 's'} selected
                    {' · '}
                    <Box
                        component="button"
                        type="button"
                        onClick={() => onSelectedLeafIdsChange([])}
                        sx={{
                            border: 'none',
                            background: 'none',
                            p: 0,
                            color: 'primary.main',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            font: 'inherit',
                        }}
                    >
                        Clear
                    </Box>
                </Typography>
            )}
            <Box sx={{ maxHeight: 360, overflow: 'auto' }}>
                {visibleNodes.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No matching ONVOC terms
                    </Typography>
                ) : (
                    <SimpleTreeView
                        expandedItems={expandedItems}
                        onExpandedItemsChange={(_event, itemIds) => {
                            if (!treeFilterQuery.trim()) {
                                setManualExpandedIds(itemIds);
                            }
                        }}
                        sx={{
                            '& .MuiTreeItem-content': {
                                py: 0.25,
                            },
                        }}
                    >
                        {renderTreeItems(visibleNodes)}
                    </SimpleTreeView>
                )}
            </Box>
        </Box>
    );
};

export default OnvocTreeFilter;
