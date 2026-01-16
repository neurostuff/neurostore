// https://guides.lib.unc.edu/systematic-reviews/write
// https://www.bmj.com/content/372/bmj.n71
// https://www.prisma-statement.org/
// https://docs.google.com/document/d/1pV_JFIXsTIGNbkKpST4nJ0-sl6Fu0Hvo/edit

// implement this via reactflow

import './Prisma.css';
import { Box } from '@mui/material';
import ReactFlow from 'reactflow';
import 'reactflow/dist/style.css';
import NeurosynthNode from './PrismaNeurosynthNode';
import { INeurosynthProject } from 'hooks/projects/useGetProjects';
import { useEffect, useState } from 'react';
import NeurosynthPRISMAHelper, { IPrismaGroup } from './Prisma.helpers';
import {
    useProjectCurationColumns,
    useProjectCurationIsPrisma,
    useProjectProvenance,
} from 'pages/Project/store/ProjectStore';

const nodeTypes = { NeurosynthNode: NeurosynthNode };

const PrismaComponent: React.FC<{ prisma?: INeurosynthProject }> = () => {
    const [height, setHeight] = useState(700);
    const [prisma, setPrisma] = useState<IPrismaGroup>({
        nodes: [],
        edges: [],
    });

    const columns = useProjectCurationColumns();
    const isPrisma = useProjectCurationIsPrisma();
    const provenance = useProjectProvenance();

    useEffect(() => {
        if (columns.length && isPrisma) {
            const prismaHelper = new NeurosynthPRISMAHelper();
            const convertedProjectToPrisma = prismaHelper.convertProjectToPRISMA(provenance);
            const prismaNodes = prismaHelper.buildPRISMA(convertedProjectToPrisma);
            setPrisma(prismaNodes);
            const includedGroupNode = prismaNodes.nodes.find((x) => x.type === 'group' && x.id === 'included-group');
            if (includedGroupNode) {
                setHeight(includedGroupNode.position.y + (includedGroupNode.style?.height as number));
            }
        }
    }, [columns, provenance, isPrisma]);

    return (
        <Box
            style={{
                height: height,
                width: '750px',
                border: '2px solid lightgray',
                borderRadius: '4px',
            }}
        >
            <ReactFlow
                nodeTypes={nodeTypes}
                defaultViewport={{ x: 20, y: 20, zoom: 0.85 }}
                edges={prisma.edges}
                zoomOnScroll={false}
                zoomOnDoubleClick={false}
                zoomOnPinch={false}
                panOnDrag={false}
                nodes={prisma.nodes}
            ></ReactFlow>
        </Box>
    );
};

export default PrismaComponent;
