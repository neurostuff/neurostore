// https://guides.lib.unc.edu/systematic-reviews/write
// https://www.bmj.com/content/372/bmj.n71
// https://www.prisma-statement.org/
// https://docs.google.com/document/d/1pV_JFIXsTIGNbkKpST4nJ0-sl6Fu0Hvo/edit

// implement this via reactflow

import './PrismaComponent.css';
import { Box } from '@mui/material';
import ReactFlow, { Controls, Background, Node, Edge, Position, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import NeurosynthNode from './NeurosynthNode';
import { INeurosynthProject } from 'hooks/requests/useGetProjects';

export interface IPRISMAWorkflow {
    identification: {
        recordsIdentified: {
            databaseName: string;
            numRecords: number;
            type: 'DATABASE' | 'REGISTER';
        }[];
        duplicateRecordsRemoved: number;
        exclusions: {
            exclusionReason: string;
            numRecords: number;
        }[];
    };
    screening: {
        numRecordsToScreen: number; // number of records identified minus number from duplicates removed
        exclusions: {
            // excluded based on title and abstract - not english, not relevant, etc
            exclusionReason: string;
            numRecords: number;
        }[];
        recordsSoughtForRetrieval: number; // number of numRecordsToScreen minus number of excluded records
        recordsNotRetrieved: number; // number of records where user is unable to retrieve full text
    };
    eligibility: {
        recordsAssessedForEligibility: number; // number of recordsSoughtForRetrieval minus recordsNotRetrieved
        exclusions: {
            exclusionReason: string;
            numRecords: number;
        }[];
    };
    included: {
        recordsIncluded: number; // recordsAssessedForEligibility minus number of records excluded during eligibility
    };
}

const prismaExample: IPRISMAWorkflow = {
    identification: {
        recordsIdentified: [
            {
                databaseName: 'PubMed',
                numRecords: 2208,
                type: 'DATABASE',
            },
            {
                databaseName: 'OTHER',
                numRecords: 9,
                type: 'DATABASE',
            },
        ],
        duplicateRecordsRemoved: 15,
        exclusions: [],
    },
    screening: {
        numRecordsToScreen: 2202,
        exclusions: [
            {
                exclusionReason: 'irrelevant',
                numRecords: 2115,
            },
        ],
        recordsSoughtForRetrieval: 87,
        recordsNotRetrieved: 0,
    },
    eligibility: {
        recordsAssessedForEligibility: 87,
        exclusions: [
            {
                exclusionReason: 'out of scope',
                numRecords: 44,
            },
            {
                exclusionReason: 'insufficient details',
                numRecords: 3,
            },
            {
                exclusionReason: 'limited rigor',
                numRecords: 3,
            },
        ],
    },
    included: {
        recordsIncluded: 37,
    },
};

interface IPrismaGroup {
    nodes: Node[];
    edges: Edge[];
}

const getEdge = (
    id: string,
    source: string,
    sourceHandle: string,
    target: string,
    targetHandle: string
): Edge => {
    return {
        id,
        source,
        sourceHandle,
        target,
        style: {
            stroke: 'black',
            strokeWidth: 2,
        },
        targetHandle,
        type: 'straight',
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'black',
        },
    };
};

const getNode = (
    id: string,
    type: 'group' | 'NeurosynthNode',
    position: { x: number; y: number }
): Node => {
    return {
        id: id,
        data: {},
        style: {
            width: '800px',
            height: '220px',
            backgroundColor: '#007bbd96',
            zIndex: -1,
        },
        type: type,
        position: position,
    };
};

// const convertProjectToPRISMA = (project: INeurosynthProject): IPRISMAWorkflow => {
//     // TODO... implement this
// }

const nodeTypes = { NeurosynthNode: NeurosynthNode };

const PrismaComponent: React.FC<{ prisma?: IPRISMAWorkflow }> = (props) => {
    const { prisma = prismaExample } = props;

    // const initIdentificationGroup = (prisma: IPRISMAWorkflow): IPrismaGroup => {
    //     const

    //     const identificationGroup: Node = {
    //         id: 'identification',
    //         data: {},
    //         style: {
    //             width: '800px',
    //             height: '220px',
    //             backgroundColor: '#007bbd96',
    //             zIndex: -1,
    //         },
    //         type: 'group',
    //         position: { x: 0, y: 0 },
    //     };

    // };

    // identification
    const identificationEdges: Edge[] = [
        getEdge(
            'identification-edge-1',
            'identification-2',
            'identification-2-right-handle',
            'identification-3',
            ''
        ),
        getEdge(
            'identification-edge-2',
            'identification-2',
            'identification-2-bottom-handle',
            'screening-2',
            'screening-2-top-handle'
        ),
    ];

    const identificationNodes: Node[] = [
        {
            id: 'identification',
            data: {},
            style: {
                width: '800px',
                height: '220px',
                backgroundColor: '#007bbd96',
                zIndex: -1,
            },
            type: 'group',
            position: { x: 0, y: 0 },
        },
        {
            id: 'identification-1',
            style: {
                rotate: '-90deg',
                width: '180px',
                zIndex: 99,
            },
            parentNode: 'identification',
            className: 'group-title-node',
            position: { x: -200, y: 10 },
            draggable: false,
            connectable: false,
            selectable: false,
            deletable: false,
            data: {
                label: 'Identification',
            },
        },
        {
            id: 'identification-2',
            position: { x: 80, y: 20 },
            style: {
                width: '300px',
                height: '180px',
                backgroundColor: 'white',
                border: '1px solid black',
                borderRadius: '4px',
            },
            draggable: false,
            connectable: false,
            parentNode: 'identification',
            selectable: false,
            className: 'group-title-node',
            deletable: false,
            type: 'NeurosynthNode',
            data: {
                label: 'Records identified from: \nDatabases (n = )\nRegisters (n = )',
                rightHandleId: 'identification-2-right-handle',
                bottomHandleId: 'identification-2-bottom-handle',
            },
        },
        {
            id: 'identification-3',
            position: { x: 490, y: 20 },
            style: {
                width: '300px',
                height: '180px',
                whiteSpace: 'pre-line',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'start',
                textAlign: 'start',
            },
            draggable: false,
            targetPosition: Position.Left,
            connectable: false,
            className: 'group-title-node',
            parentNode: 'identification',
            selectable: false,
            deletable: false,
            data: {
                label: 'Records removed before screening: \nDuplicate records removed (n = )',
            },
        },
    ];

    // screening
    const screeningEdges: Edge[] = [];
    const screeningNodes: Node[] = [
        {
            id: 'screening',
            data: {},
            style: {
                width: '800px',
                height: '220px',
                backgroundColor: '#007bbd96',
                zIndex: -1,
            },
            type: 'group',
            position: { x: 0, y: 240 },
        },
        {
            id: 'screening-1',
            style: {
                rotate: '-90deg',
                width: '190px',
            },
            parentNode: 'screening',
            className: 'group-title-node',
            position: { x: -450, y: -230 },
            draggable: false,
            connectable: false,
            selectable: false,
            deletable: false,
            data: {
                label: 'Screening',
            },
        },
        {
            id: 'screening-2',
            position: { x: 80, y: 20 },
            style: {
                width: '300px',
                height: '50px',
                backgroundColor: 'white',
                border: '1px solid black',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'start',
                textAlign: 'start',
            },
            draggable: false,
            connectable: false,
            sourcePosition: Position.Right,
            parentNode: 'screening',
            selectable: false,
            className: 'group-title-node',
            deletable: false,
            type: 'NeurosynthNode',
            data: {
                label: 'Records Screened\n(n = )',
                topHandleId: 'screening-2-top-handle',
            },
        },
        {
            id: 'screening-3',
            position: { x: 80, y: 90 },
            style: {
                width: '300px',
                height: '50px',
                backgroundColor: 'white',
                border: '1px solid black',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'start',
                textAlign: 'start',
            },
            draggable: false,
            connectable: false,
            sourcePosition: Position.Right,
            parentNode: 'screening',
            selectable: false,
            className: 'group-title-node',
            deletable: false,
            type: 'NeurosynthNode',
            data: {
                label: 'Reports Sought for Retrieval\n(n = )',
                topHandleId: 'screening-2-top-handle',
            },
        },
        {
            id: 'screening-4',
            position: { x: 80, y: 160 },
            style: {
                width: '300px',
                height: '50px',
                backgroundColor: 'white',
                border: '1px solid black',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'start',
                textAlign: 'start',
            },
            draggable: false,
            connectable: false,
            sourcePosition: Position.Right,
            parentNode: 'screening',
            selectable: false,
            className: 'group-title-node',
            deletable: false,
            type: 'NeurosynthNode',
            data: {
                label: 'Reports Assessed for Eligibility\n(n = )',
                topHandleId: 'screening-2-top-handle',
            },
        },
    ];

    // eligibility
    const eligibilityEdges: Edge[] = [];

    const eligibilityNodes: Node[] = [];

    // included
    const includedEdges: Edge[] = [];
    const includedNodes: Node[] = [];

    const allEdges: Edge[] = [
        ...identificationEdges,
        ...screeningEdges,
        ...eligibilityEdges,
        ...includedEdges,
    ];

    const allNodes: Node[] = [
        ...identificationNodes,
        ...screeningNodes,
        ...eligibilityNodes,
        ...includedNodes,
    ];

    return (
        <Box style={{ height: '100%' }}>
            <ReactFlow nodeTypes={nodeTypes} edges={allEdges} nodes={allNodes}>
                <Background />
                <Controls />
            </ReactFlow>
        </Box>
    );
};

export default PrismaComponent;
