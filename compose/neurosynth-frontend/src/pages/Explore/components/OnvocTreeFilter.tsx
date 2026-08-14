import { ExpandMore, Search } from '@mui/icons-material';
import { Box, Checkbox, FormControlLabel, IconButton, InputAdornment, TextField, Tooltip, Typography } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useMemo, useState } from 'react';
import { getOnvocLabelById, OnvocTreeNode } from 'pages/Explore/Explore.mockData';
import useOnvocTreeFilter, { toOnvocTreeItemId } from 'pages/Explore/hooks/useOnvocTreeFilter';

type OnvocTreeFilterProps = {
    title: string;
    nodes: OnvocTreeNode[];
    selectedLeafIds: string[];
    onSelectedLeafIdsChange: (leafIds: string[]) => void;
};

const OnvocTreeFilter = ({ title, nodes, selectedLeafIds, onSelectedLeafIdsChange }: OnvocTreeFilterProps) => {
    const [isSectionExpanded, setIsSectionExpanded] = useState(true);
    const {
        treeFilterQuery,
        setTreeFilterQuery,
        visibleNodes,
        expandedItems,
        selectedLeafIdSet,
        selectedIdsInTree,
        handleLeafToggle,
        handleClearSelectedInTree,
        handleExpandedItemsChange,
    } = useOnvocTreeFilter({ nodes, selectedLeafIds, onSelectedLeafIdsChange });

    const selectedLabelsInTree = useMemo(
        () =>
            selectedIdsInTree
                .map((leafId) => {
                    const label = getOnvocLabelById(nodes, leafId);
                    return label ? { leafId, label } : null;
                })
                .filter((entry): entry is { leafId: string; label: string } => entry !== null),
        [nodes, selectedIdsInTree]
    );

    const renderTreeItems = (treeNodes: OnvocTreeNode[], pathIds: string[] = []) =>
        treeNodes.map((node) => {
            const itemPathIds = [...pathIds, node.id];
            const itemId = toOnvocTreeItemId(itemPathIds);
            const isLeaf = !node.children?.length;
            if (isLeaf) {
                return (
                    <TreeItem
                        key={itemId}
                        itemId={itemId}
                        label={
                            <FormControlLabel
                                onClick={(event) => event.stopPropagation()}
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={selectedLeafIdSet.has(node.id)}
                                        onChange={(event) => handleLeafToggle(node.id, event.target.checked)}
                                        sx={{
                                            p: 0.25,
                                            '& .MuiSvgIcon-root': { fontSize: 16 },
                                        }}
                                    />
                                }
                                label={<Typography variant="body2">{node.label}</Typography>}
                                sx={{ ml: 0, mr: 0, gap: 0.5 }}
                            />
                        }
                    />
                );
            }

            return (
                <TreeItem key={itemId} itemId={itemId} label={node.label}>
                    {renderTreeItems(node.children ?? [], itemPathIds)}
                </TreeItem>
            );
        });

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {title}
                </Typography>
                <IconButton
                    size="small"
                    onClick={() => setIsSectionExpanded((previous) => !previous)}
                    aria-label={isSectionExpanded ? `Collapse ${title}` : `Expand ${title}`}
                    aria-expanded={isSectionExpanded}
                >
                    <ExpandMore
                        fontSize="small"
                        sx={{
                            transform: isSectionExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 150ms ease',
                        }}
                    />
                </IconButton>
            </Box>
            {isSectionExpanded && (
                <>
                    <TextField
                        size="small"
                        fullWidth
                        value={treeFilterQuery}
                        onChange={(event) => setTreeFilterQuery(event.target.value)}
                        placeholder={`Filter ${title.toLowerCase()}…`}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ mb: 1 }}
                    />
                    {selectedIdsInTree.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            <Tooltip
                                title={
                                    <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                        {selectedLabelsInTree.map(({ leafId, label }) => (
                                            <Box component="li" key={leafId}>
                                                {label}
                                            </Box>
                                        ))}
                                    </Box>
                                }
                                placement="top"
                            >
                                <Box component="span" sx={{ cursor: 'default', borderBottom: '1px dotted' }}>
                                    {selectedIdsInTree.length} term{selectedIdsInTree.length === 1 ? '' : 's'} selected
                                </Box>
                            </Tooltip>
                            {' · '}
                            <Box
                                component="button"
                                type="button"
                                onClick={handleClearSelectedInTree}
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
                    <Box className="sleek-scrollbar" sx={{ maxHeight: 200, overflow: 'auto' }}>
                        {visibleNodes.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                No matching ONVOC terms
                            </Typography>
                        ) : (
                            <SimpleTreeView
                                expandedItems={expandedItems}
                                onExpandedItemsChange={(_event, itemIds) => handleExpandedItemsChange(itemIds)}
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
                </>
            )}
        </Box>
    );
};

export default OnvocTreeFilter;
