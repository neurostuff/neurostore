// https://guides.lib.unc.edu/systematic-reviews/write
// https://www.bmj.com/content/372/bmj.n71
// https://www.prisma-statement.org/
// https://docs.google.com/document/d/1pV_JFIXsTIGNbkKpST4nJ0-sl6Fu0Hvo/edit

// implement this via reactflow

import './PrismaComponent.css';
import { Box } from '@mui/material';
import ReactFlow from 'reactflow';
import 'reactflow/dist/style.css';
import NeurosynthNode from './NeurosynthNode';
import { INeurosynthProject } from 'hooks/requests/useGetProjects';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import NeurosynthPRISMAHelper, { IPrismaGroup } from './PrismaHelpers';

const nodeTypes = { NeurosynthNode: NeurosynthNode };

const PrismaComponent: React.FC<{ prisma?: INeurosynthProject }> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const { data: project } = useGetProjectById(projectId);
    const [height, setHeight] = useState(700);
    const [prisma, setPrisma] = useState<IPrismaGroup>({
        nodes: [],
        edges: [],
    });

    useEffect(() => {
        if (
            project?.provenance?.curationMetadata?.columns?.length &&
            project.provenance.curationMetadata.prismaConfig.isPrisma
        ) {
            const prismaHelper = new NeurosynthPRISMAHelper();
            console.log(project);
            const convertedProjectToPrisma = prismaHelper.convertProjectToPRISMA(project);
            const prismaNodes = prismaHelper.buildPRISMA(convertedProjectToPrisma);
            setPrisma(prismaNodes);
            const includedGroupNode = prismaNodes.nodes.find(
                (x) => x.type === 'group' && x.id === 'included-group'
            );
            if (includedGroupNode) {
                setHeight(
                    includedGroupNode.position.y + (includedGroupNode.style?.height as number)
                );
            }
        }
    }, [project]);

    return (
        <Box style={{ height: height, width: '100%' }}>
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
