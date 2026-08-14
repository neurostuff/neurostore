import { useMemo, useState } from 'react';
import { OnvocTreeNode } from 'pages/Explore/Explore.mockData';

const ITEM_ID_SEPARATOR = '::';

export const toOnvocTreeItemId = (pathIds: string[]) => pathIds.join(ITEM_ID_SEPARATOR);

const collectLeafIds = (treeNodes: OnvocTreeNode[]): string[] => {
    const leafIds: string[] = [];
    const walk = (node: OnvocTreeNode) => {
        if (!node.children?.length) {
            leafIds.push(node.id);
            return;
        }
        node.children.forEach(walk);
    };
    treeNodes.forEach(walk);
    return leafIds;
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

    const filterNode = (node: OnvocTreeNode, pathIds: string[]): OnvocTreeNode | null => {
        const itemPathIds = [...pathIds, node.id];
        const itemId = toOnvocTreeItemId(itemPathIds);
        const labelMatches = node.label.toLowerCase().includes(normalizedQuery);
        const hasOriginalChildren = Boolean(node.children?.length);

        // Parent header matched — keep the full subtree so it stays a header, not a leaf checkbox.
        if (labelMatches && hasOriginalChildren) {
            expandedIds.push(itemId);
            return { ...node, children: node.children };
        }

        const filteredChildren = (node.children ?? [])
            .map((child) => filterNode(child, itemPathIds))
            .filter((child): child is OnvocTreeNode => child !== null);

        if (filteredChildren.length > 0) {
            expandedIds.push(itemId);
            return {
                ...node,
                children: filteredChildren,
            };
        }

        if (labelMatches) {
            return { ...node };
        }

        return null;
    };

    return {
        nodes: nodes.map((node) => filterNode(node, [])).filter((node): node is OnvocTreeNode => node !== null),
        expandedIds,
    };
};

type UseOnvocTreeFilterArgs = {
    nodes: OnvocTreeNode[];
    selectedLeafIds: string[];
    onSelectedLeafIdsChange: (leafIds: string[]) => void;
};

const useOnvocTreeFilter = ({ nodes, selectedLeafIds, onSelectedLeafIdsChange }: UseOnvocTreeFilterArgs) => {
    const [treeFilterQuery, setTreeFilterQuery] = useState('');
    const [manualExpandedIds, setManualExpandedIds] = useState<string[]>([]);

    const { nodes: visibleNodes, expandedIds: filterExpandedIds } = useMemo(
        () => filterOnvocTree(nodes, treeFilterQuery),
        [nodes, treeFilterQuery]
    );

    const isFiltering = Boolean(treeFilterQuery.trim());
    const expandedItems = isFiltering ? filterExpandedIds : manualExpandedIds;
    const selectedLeafIdSet = useMemo(() => new Set(selectedLeafIds), [selectedLeafIds]);
    const treeLeafIdSet = useMemo(() => new Set(collectLeafIds(nodes)), [nodes]);
    const selectedIdsInTree = useMemo(
        () => selectedLeafIds.filter((leafId) => treeLeafIdSet.has(leafId)),
        [selectedLeafIds, treeLeafIdSet]
    );

    const handleLeafToggle = (leafId: string, checked: boolean) => {
        if (checked) {
            onSelectedLeafIdsChange([...selectedLeafIds, leafId]);
        } else {
            onSelectedLeafIdsChange(selectedLeafIds.filter((id) => id !== leafId));
        }
    };

    const handleClearSelectedInTree = () => {
        onSelectedLeafIdsChange(selectedLeafIds.filter((leafId) => !treeLeafIdSet.has(leafId)));
    };

    const handleExpandedItemsChange = (itemIds: string[]) => {
        if (!isFiltering) {
            setManualExpandedIds(itemIds);
        }
    };

    return {
        treeFilterQuery,
        setTreeFilterQuery,
        visibleNodes,
        expandedItems,
        selectedLeafIdSet,
        selectedIdsInTree,
        handleLeafToggle,
        handleClearSelectedInTree,
        handleExpandedItemsChange,
    };
};

export default useOnvocTreeFilter;
