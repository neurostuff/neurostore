import { ICurationColumn, ICurationStubStudy } from 'pages/Curation/Curation.types';
import { INeurosynthNodeData } from 'pages/Curation/components/PrismaNeurosynthNode';
import { ENeurosynthTagIds } from 'pages/Project/store/ProjectStore.consts';
import { CSSProperties } from 'react';
import { Edge, MarkerType, Node } from 'reactflow';
import { IProvenance, ISource, ITag } from 'hooks/projects/useGetProjects';
import { getExclusionsHelper } from 'pages/Project/store/ProjectStore.helpers';

type IPRISMAExclusion = ITag & { numRecords: number };

export interface IPRISMAIdentification {
    recordsIdentified: {
        databaseName: string;
        numRecords: number;
        type: 'DATABASE' | 'REGISTER';
    }[];
    exclusions: IPRISMAExclusion[];
    numUncategorized: number;
}

export interface IPRISMAScreening {
    numRecordsToScreen: number; // number of records identified minus number from duplicates removed
    // excluded based on title and abstract - not english, not relevant, etc
    exclusions: IPRISMAExclusion[];
    numUncategorized: number;
}

export interface IPRISMAEligibility {
    recordsNotRetrieved: number; // number of records where user is unable to retrieve full text
    recordsSoughtForRetrieval: number; // number of numRecordsToScreen minus number of excluded records
    recordsAssessedForEligibility: number; // number of recordsSoughtForRetrieval minus recordsNotRetrieved
    exclusions: IPRISMAExclusion[];
    numUncategorized: number;
}

export interface IPRISMAIncluded {
    recordsIncluded: number; // recordsAssessedForEligibility minus number of records excluded during eligibility
}

export interface IPrismaGroup {
    nodes: Node[];
    edges: Edge[];
}

export class CPRISMAWorkflow {
    identification: IPRISMAIdentification;
    screening: IPRISMAScreening;
    eligibility: IPRISMAEligibility;
    included: IPRISMAIncluded;

    constructor() {
        this.identification = {
            recordsIdentified: [],
            exclusions: [],
            numUncategorized: 0,
        };

        this.screening = {
            numRecordsToScreen: 0,
            exclusions: [],
            numUncategorized: 0,
        };

        this.eligibility = {
            recordsNotRetrieved: 0,
            recordsSoughtForRetrieval: 0,
            recordsAssessedForEligibility: 0,
            exclusions: [],
            numUncategorized: 0,
        };

        this.included = {
            recordsIncluded: 0,
        };
    }
}

class NeurosynthPRISMAHelper {
    private getRecordIdentificationSources = (
        cols: ICurationColumn[]
    ): {
        databaseName: string;
        numRecords: number;
        type: 'DATABASE' | 'REGISTER';
    }[] => {
        const nonIncludedCols = [...cols];
        nonIncludedCols.pop();
        const studies: ICurationStubStudy[] = nonIncludedCols.reduce((acc, curr) => {
            acc.push(...curr.stubStudies.filter((x) => !!x.exclusionTag));
            return acc;
        }, [] as ICurationStubStudy[]);
        studies.push(...cols[3].stubStudies);

        const map = new Map<string, { source: ISource; count: number }>();

        studies.forEach((study) => {
            const sourceId = study.identificationSource.id;
            const mapObj = map.get(sourceId);

            if (mapObj) {
                map.set(sourceId, {
                    ...mapObj,
                    count: mapObj.count + 1,
                });
            } else {
                map.set(sourceId, {
                    source: study.identificationSource,
                    count: 1,
                });
            }
        });

        return Array.from(map).map(([, mapObj]) => ({
            databaseName: mapObj.source.label,
            numRecords: mapObj.count,
            type: 'DATABASE',
        }));
    };

    private getExclusionsFromCol = (col: ICurationColumn, exclusions: ITag[]): IPRISMAExclusion[] => {
        const studies = col.stubStudies;

        const map = new Map<string, { exclusion: ITag; count: number }>();

        studies.forEach((study) => {
            if (!study.exclusionTag) return;
            const mapObj = map.get(study.exclusionTag);

            if (mapObj) {
                map.set(study.exclusionTag, {
                    ...mapObj,
                    count: mapObj.count + 1,
                });
            } else {
                const exclusion = exclusions.find((x) => x.id === study.exclusionTag);
                if (!exclusion) return;
                map.set(study.exclusionTag, {
                    exclusion: exclusion,
                    count: 1,
                });
            }
        });

        return Array.from(map).map(([, mapObj]) => ({
            ...mapObj.exclusion,
            numRecords: mapObj.count,
        }));
    };

    private getEdge = (
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
            targetHandle,
            style: {
                stroke: 'black',
                strokeWidth: 2,
            },
            type: 'straight',
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: 'black',
            },
        };
    };

    private getNode = (
        id: string,
        nodeType: 'group' | 'label' | 'node' | 'warning-node',
        position: { x: number; y: number },
        style?: CSSProperties,
        parentNode?: string,
        data?: INeurosynthNodeData
    ): Node => {
        switch (nodeType) {
            case 'group':
                return {
                    id,
                    data: {
                        sx: {
                            color: '#bfa73f !important',
                        },
                        ...data,
                    },
                    style: {
                        width: 700,
                        height: 140,
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                        zIndex: -1,
                        ...(style || {}),
                    },
                    type: 'group',
                    position,
                    draggable: false,
                    selectable: false,
                    deletable: false,
                    connectable: false,
                };
            case 'label':
                return {
                    id,
                    data: data || {},
                    style: {
                        width: 100,
                        zIndex: 99,
                        fontWeight: 'bold',
                        rotate: '-90deg',
                        backgroundColor: '#9dc3e7',
                        ...(style || {}),
                    },
                    position,
                    parentNode,
                    className: 'group-title-node',
                    draggable: false,
                    selectable: false,
                    deletable: false,
                    connectable: false,
                };
            case 'warning-node':
                return {
                    id,
                    data: data || {},
                    style: {
                        zIndex: 99,
                        width: 120,
                        height: 40,
                        color: '#bfa73f',
                        borderColor: '#bfa73f',
                        display: 'flex',
                        alignItems: 'center',
                        ...(style || {}),
                    },
                    position,
                    parentNode,
                    className: 'group-title-node',
                    draggable: false,
                    selectable: false,
                    deletable: false,
                    connectable: false,
                };
            case 'node':
                return {
                    id,
                    data: data || {},
                    style: {
                        zIndex: 99,
                        width: 240,
                        height: 40,
                        ...(style || {}),
                    },
                    position,
                    parentNode,
                    type: 'NeurosynthNode',
                    className: 'group-title-node',
                    draggable: false,
                    selectable: false,
                    deletable: false,
                    connectable: false,
                };
            default:
                throw new Error('invalid PRISMA node type');
        }
    };

    private buildIdentificationNodeGroup = (
        identification: IPRISMAIdentification,
        prevGroupNode: Node | undefined
    ): IPrismaGroup => {
        const nodes: Node[] = [];
        const identificationGroupParentNode = 'identification-group';

        // node height in pixels.
        // 90, for the initial text (accommodate the label) and 40 for each subsequent text (two lines)
        const leftNodeHeight = 90 + identification.recordsIdentified.length * 40;
        const rightNodeHeight = 90 + identification.exclusions.length * 40;

        const nodeHeight = leftNodeHeight >= rightNodeHeight ? leftNodeHeight : rightNodeHeight;

        const leftNode = this.getNode(
            'identification-node-1',
            'node',
            { x: 80, y: 20 },
            {
                height: nodeHeight,
            },
            identificationGroupParentNode,
            {
                label: identification.recordsIdentified.reduce(
                    (acc, curr) => `${acc}\nDatabases: ${curr.databaseName}\n(n = ${curr.numRecords})`,
                    'Records identified from:\n'
                ),
                rightHandleId: 'identification-node-1-right-source',
                bottomHandleId: 'identification-node-1-bottom-source',
            }
        );
        nodes.push(leftNode);
        const rightNode = this.getNode(
            'identification-node-2',
            'node',
            { x: 420, y: 20 },
            { height: nodeHeight },
            identificationGroupParentNode,
            {
                label: identification.exclusions.reduce(
                    (acc, curr) => `${acc}\n${curr.label}\n(n = ${curr.numRecords})`,
                    'Records removed before screening:\n'
                ),
                leftHandleId: 'identification-node-2-left-target',
            }
        );
        nodes.push(rightNode);

        if (identification.numUncategorized > 0) {
            const noStudiesNode = this.getNode(
                'identification-no-studies-node-1',
                'warning-node',
                { x: 720, y: 20 },
                { height: nodeHeight },
                identificationGroupParentNode,
                {
                    label: `${identification.numUncategorized} uncategorized study/studies have been omitted from the diagram`,
                }
            );
            nodes.push(noStudiesNode);
        }

        // get the height of the previous element (the main title bar)
        const prevHeight = parseInt(prevGroupNode?.style?.height?.toString() || '700');
        const labelNode = this.getNode(
            'identification-label',
            'label',
            // -20 accounts for top and bottom border padding
            // -10 accounts for space after main title bar (added in the group node below)
            // subtract prevHeight
            { x: -30 - nodeHeight - prevHeight, y: 10 - prevHeight },
            {
                width: nodeHeight,
            },
            identificationGroupParentNode,
            {
                label: 'Identification',
            }
        );
        nodes.push(labelNode);
        const groupNode = this.getNode(
            identificationGroupParentNode,
            'group',
            { x: 0, y: prevHeight + 10 },
            {
                height: nodeHeight + 40,
            },
            undefined,
            undefined
        );
        nodes.push(groupNode);

        const leftToRightNodeEdge = this.getEdge(
            'identification-edge-1',
            'identification-node-1',
            'identification-node-1-right-source',
            'identification-node-2',
            'identification-node-2-left-target'
        );

        return {
            edges: [leftToRightNodeEdge],
            nodes: nodes,
        };
    };

    private buildScreeningNodeGroup = (screening: IPRISMAScreening, prevGroupNode: Node | undefined) => {
        if (!prevGroupNode) throw new Error('previous group node not found');
        const nodes: Node[] = [];
        const screeningGroupParentNode = 'screening-group';

        // node height in pixels.
        // 30 for the initial text and 40 for each subsequent text (two lines)
        const leftNodeHeight = 50 + 40;
        const rightNodeHeight = 50 + screening.exclusions.length * 40;

        const topNodeHeight = leftNodeHeight >= rightNodeHeight ? leftNodeHeight : rightNodeHeight;

        const leftTopNode = this.getNode(
            'screening-node-1',
            'node',
            { x: 80, y: 20 },
            {
                height: topNodeHeight,
            },
            screeningGroupParentNode,
            {
                label: `Records screened\n(n = ${screening.numRecordsToScreen})`,
                topHandleId: 'screening-node-1-top-target',
                rightHandleId: 'screening-node-1-right-source',
                bottomHandleId: 'screening-node-1-bottom-source',
            }
        );
        nodes.push(leftTopNode);
        const rightTopNode = this.getNode(
            'screening-node-2',
            'node',
            { x: 420, y: 20 },
            { height: topNodeHeight },
            screeningGroupParentNode,
            {
                label: screening.exclusions.reduce(
                    (acc, curr) => `${acc}\n${curr.label}\n(n = ${curr.numRecords})`,
                    'Records excluded:\n'
                ),
                leftHandleId: 'screening-node-2-left-target',
            }
        );
        nodes.push(rightTopNode);

        if (screening.numUncategorized > 0) {
            const noStudiesNode = this.getNode(
                'screening-no-studies-node-1',
                'warning-node',
                { x: 720, y: 20 },
                {
                    height: topNodeHeight,
                },
                screeningGroupParentNode,
                {
                    label: `${screening.numUncategorized} uncategorized study/studies have been omitted from the diagram`,
                }
            );
            nodes.push(noStudiesNode);
        }

        const prevHeight = parseInt(prevGroupNode.style?.height?.toString() || '700');
        const prevPosition = prevGroupNode.position.y + prevHeight;
        const labelNode = this.getNode(
            'screening-label',
            'label',
            {
                x: -30 - topNodeHeight - prevPosition,
                y: 10 - prevPosition,
            },
            {
                width: topNodeHeight,
            },
            screeningGroupParentNode,
            {
                label: 'Screening',
            }
        );
        nodes.push(labelNode);

        const groupNode = this.getNode(
            screeningGroupParentNode,
            'group',
            { x: 0, y: prevPosition + 10 },
            {
                height: topNodeHeight + 40,
            },
            undefined,
            undefined
        );
        nodes.push(groupNode);

        const identificationToScreeningNodeEdge = this.getEdge(
            'identification-screening-edge-1',
            'identification-node-1',
            'identification-node-1-bottom-source',
            'screening-node-1',
            'screening-node-1-top-target'
        );
        const topLeftToTopRightEdge = this.getEdge(
            'screening-edge-1',
            'screening-node-1',
            'screening-node-1-right-source',
            'screening-node-2',
            'screening-node-2-left-target'
        );

        return {
            edges: [topLeftToTopRightEdge, identificationToScreeningNodeEdge],
            nodes: nodes,
        };
    };

    private buildEligibilityNodeGroup = (
        eligibility: IPRISMAEligibility,
        prevGroupNode: Node | undefined
    ): IPrismaGroup => {
        if (!prevGroupNode) throw new Error('previous group node not found');
        const nodes: Node[] = [];
        const eligibilityGroupParentNode = 'eligibility-group';
        const topNodeHeight = 70;
        const distanceBetweenTopAndBottomNode = 40;

        const leftTopNode = this.getNode(
            'eligibility-node-1',
            'node',
            { x: 80, y: 20 },
            { height: topNodeHeight },
            eligibilityGroupParentNode,
            {
                label: `Reports sought for retrieval\n(n = ${eligibility.recordsSoughtForRetrieval})`,
                rightHandleId: 'eligibility-node-1-right-source',
                bottomHandleId: 'eligibility-node-1-bottom-source',
                topHandleId: 'eligibility-node-1-top-target',
            }
        );
        nodes.push(leftTopNode);

        const rightTopNode = this.getNode(
            'eligibility-node-2',
            'node',
            { x: 420, y: 20 },
            { height: topNodeHeight },
            eligibilityGroupParentNode,
            {
                label: `Reports not retrieved\n(n = ${eligibility.recordsNotRetrieved})`,
                leftHandleId: 'eligibility-node-2-left-target',
            }
        );
        nodes.push(rightTopNode);

        const leftBottomNodeHeight = 50 + 40;
        const rightBottomNodeHeight = 50 + eligibility.exclusions.length * 40;
        const bottomNodeHeight =
            leftBottomNodeHeight >= rightBottomNodeHeight ? leftBottomNodeHeight : rightBottomNodeHeight;

        const leftBottomNode = this.getNode(
            `eligibility-node-3`,
            'node',
            { x: 80, y: 20 + topNodeHeight + distanceBetweenTopAndBottomNode },
            { height: bottomNodeHeight },
            eligibilityGroupParentNode,
            {
                label: `Reports assessed for eligibility\n(n = ${eligibility.recordsAssessedForEligibility})`,
                topHandleId: 'eligibility-node-3-top-target',
                rightHandleId: 'eligibility-node-3-right-source',
                bottomHandleId: 'eligibility-node-3-bottom-source',
            }
        );
        nodes.push(leftBottomNode);

        const rightBottomNode = this.getNode(
            `eligibility-node-4`,
            'node',
            { x: 420, y: 20 + topNodeHeight + distanceBetweenTopAndBottomNode },
            { height: bottomNodeHeight },
            eligibilityGroupParentNode,
            {
                label: eligibility.exclusions.reduce(
                    (acc, curr) => `${acc}\n${curr.label}\n(n = ${curr.numRecords})`,
                    'Reports excluded:\n'
                ),
                leftHandleId: 'eligibility-node-4-left-target',
            }
        );
        nodes.push(rightBottomNode);

        if (eligibility.numUncategorized > 0) {
            const noStudiesNode = this.getNode(
                'eligibility-no-studies-node-1',
                'warning-node',
                { x: 720, y: 20 },
                {
                    height: bottomNodeHeight + distanceBetweenTopAndBottomNode + topNodeHeight,
                },
                eligibilityGroupParentNode,
                {
                    label: `${eligibility.numUncategorized} uncategorized study/studies have been omitted from the diagram`,
                }
            );
            nodes.push(noStudiesNode);
        }

        const prevHeight = parseInt(prevGroupNode.style?.height?.toString() || '700');
        const prevPosition = prevGroupNode.position.y + prevHeight;
        const labelNode = this.getNode(
            `eligibility-label`,
            'label',
            {
                x: -30 - bottomNodeHeight - prevPosition - distanceBetweenTopAndBottomNode - topNodeHeight,
                y: 10 - prevPosition,
            },
            { width: bottomNodeHeight + distanceBetweenTopAndBottomNode + topNodeHeight },
            eligibilityGroupParentNode,
            {
                label: `Eligibility`,
            }
        );
        nodes.push(labelNode);
        const groupNode = this.getNode(
            eligibilityGroupParentNode,
            'group',
            { x: 0, y: prevPosition + 10 },
            { height: bottomNodeHeight + distanceBetweenTopAndBottomNode + topNodeHeight + 40 },
            undefined,
            undefined
        );
        nodes.push(groupNode);

        const screeningToEligibilityEdge = this.getEdge(
            'screening-eligibility-edge-1',
            'screening-node-1',
            'screening-node-1-bottom-source',
            'eligibility-node-1',
            'eligibility-node-1-top-target'
        );
        const topLeftToTopRightEdge = this.getEdge(
            'eligibility-edge-1',
            'eligibility-node-1',
            'eligibility-node-1-right-source',
            'eligibility-node-2',
            'eligibility-node-2-left-target'
        );
        const topLeftToBottomLeftEdge = this.getEdge(
            'eligibility-edge-2',
            'eligibility-node-1',
            'eligibility-node-1-bottom-source',
            'eligibility-node-3',
            'eligibility-node-3-top-target'
        );
        const bottomLeftToBottomRightEdge = this.getEdge(
            'eligibility-edge-3',
            'eligibility-node-3',
            'eligibility-node-3-right-source',
            'eligibility-node-4',
            'eligibility-node-4-left-target'
        );

        return {
            edges: [
                screeningToEligibilityEdge,
                topLeftToTopRightEdge,
                topLeftToBottomLeftEdge,
                bottomLeftToBottomRightEdge,
            ],
            nodes: nodes,
        };
    };

    private buildIncludedNodeGroup = (included: IPRISMAIncluded, prevGroupNode: Node | undefined): IPrismaGroup => {
        if (!prevGroupNode) throw new Error('previous group node not found');
        const includedGroupParentNode = 'included-group';

        const nodeHeight = 50 + 40;

        const leftNode = this.getNode(
            `included-node-1`,
            'node',
            { x: 80, y: 20 },
            { height: nodeHeight },
            includedGroupParentNode,
            {
                label: `Studies included in review\n(n = ${included.recordsIncluded})`,
                topHandleId: 'included-node-1-top-target',
            }
        );

        const prevHeight = parseInt(prevGroupNode.style?.height?.toString() || '700');
        const prevPosition = prevGroupNode.position.y + prevHeight;
        const labelNode = this.getNode(
            `included-label`,
            'label',
            {
                x: -30 - nodeHeight - prevPosition,
                y: 10 - prevPosition,
            },
            { width: nodeHeight },
            includedGroupParentNode,
            { label: `Included` }
        );
        const groupNode = this.getNode(
            includedGroupParentNode,
            'group',
            { x: 0, y: prevPosition + 10 },
            { height: nodeHeight + 40 },
            undefined,
            undefined
        );

        const eligibilityToIncludedEdge = this.getEdge(
            'eligibility-included-edge-1',
            'eligibility-node-3',
            'eligibility-node-3-bottom-source',
            'included-node-1',
            'included-node-1-top-target'
        );

        return {
            edges: [eligibilityToIncludedEdge],
            nodes: [groupNode, leftNode, labelNode],
        };
    };

    convertProjectToPRISMA = (provenance: IProvenance): CPRISMAWorkflow => {
        const prismaWorkflow = new CPRISMAWorkflow();
        const exclusionTags = getExclusionsHelper(provenance);
        const { curationMetadata } = provenance;

        if (curationMetadata && curationMetadata.columns && curationMetadata.columns.length > 0) {
            // IDENTIFICATION STEP
            // predefine variables
            const identificationColumn = curationMetadata.columns[0];

            // set values
            prismaWorkflow.identification.recordsIdentified = this.getRecordIdentificationSources(
                curationMetadata.columns
            );
            prismaWorkflow.identification.exclusions = this.getExclusionsFromCol(identificationColumn, exclusionTags);
            prismaWorkflow.identification.numUncategorized = identificationColumn.stubStudies.filter(
                (x) => !x.exclusionTag
            ).length;

            // SCREENING STEP
            // predefined variables
            const { recordsIdentified, exclusions: identificationExclusions } = prismaWorkflow.identification;
            const numRecordsIdentified = recordsIdentified.reduce((acc, curr) => acc + curr.numRecords, 0);
            const numIdentificationRecordsExcluded = identificationExclusions.reduce(
                (acc, curr) => acc + curr.numRecords,
                0
            );
            const screeningCol = curationMetadata.columns[1];

            // set values
            prismaWorkflow.screening.exclusions = this.getExclusionsFromCol(screeningCol, exclusionTags);
            prismaWorkflow.screening.numRecordsToScreen = numRecordsIdentified - numIdentificationRecordsExcluded;
            prismaWorkflow.screening.numUncategorized = screeningCol.stubStudies.filter((x) => !x.exclusionTag).length;

            // ELIGIBILITY STEP
            // predefine variables
            const { exclusions: screeningExclusions, numRecordsToScreen } = prismaWorkflow.screening;
            const screeningStepNumRecordsExcluded = screeningExclusions.reduce((acc, curr) => acc + curr.numRecords, 0);
            const eligibilityCol = curationMetadata.columns[2];

            // set values
            prismaWorkflow.eligibility.recordsSoughtForRetrieval = numRecordsToScreen - screeningStepNumRecordsExcluded;
            prismaWorkflow.eligibility.recordsNotRetrieved = (
                eligibilityCol.stubStudies.filter(
                    (x) => x.exclusionTag === ENeurosynthTagIds.REPORTS_NOT_RETRIEVED_EXCLUSION_ID
                ) || []
            ).length;
            prismaWorkflow.eligibility.recordsAssessedForEligibility =
                prismaWorkflow.eligibility.recordsSoughtForRetrieval - prismaWorkflow.eligibility.recordsNotRetrieved;
            prismaWorkflow.eligibility.exclusions = this.getExclusionsFromCol(eligibilityCol, exclusionTags).filter(
                (x) => x.id !== ENeurosynthTagIds.REPORTS_NOT_RETRIEVED_EXCLUSION_ID
            );
            prismaWorkflow.eligibility.numUncategorized = curationMetadata.columns[2].stubStudies.filter(
                (x) => !x.exclusionTag
            ).length;

            // INCLUDED STEP
            // predefine variables
            const eligibilityNumRecordsExcluded = prismaWorkflow.eligibility.exclusions.reduce(
                (acc, curr) => acc + curr.numRecords,
                0
            );
            const { recordsAssessedForEligibility } = prismaWorkflow.eligibility;

            // set values
            prismaWorkflow.included.recordsIncluded = recordsAssessedForEligibility - eligibilityNumRecordsExcluded;
        }
        return prismaWorkflow;
    };

    buildPRISMA = (prisma: CPRISMAWorkflow): IPrismaGroup => {
        const mainLabelNode: Node = {
            id: 'prisma-label',
            data: {
                label: 'Identification of studies via databases and registers',
            },
            style: {
                width: 580,
                height: 40,
                fontWeight: 'bold',
                backgroundColor: '#ffc000',
                zIndex: -1,
            },
            className: 'group-title-node',
            position: { x: 80, y: 0 },
        };

        const identificationGroup = this.buildIdentificationNodeGroup(prisma.identification, mainLabelNode);
        const screeningGroup = this.buildScreeningNodeGroup(
            prisma.screening,
            identificationGroup.nodes.find((x) => x.type === 'group')
        );
        const eligibilityGroup = this.buildEligibilityNodeGroup(
            prisma.eligibility,
            screeningGroup.nodes.find((x) => x.type === 'group')
        );
        const includedGroup = this.buildIncludedNodeGroup(
            prisma.included,
            eligibilityGroup.nodes.find((x) => x.type === 'group')
        );

        return {
            edges: [
                ...identificationGroup.edges,
                ...screeningGroup.edges,
                ...eligibilityGroup.edges,
                ...includedGroup.edges,
            ],
            nodes: [
                mainLabelNode,
                ...identificationGroup.nodes,
                ...screeningGroup.nodes,
                ...eligibilityGroup.nodes,
                ...includedGroup.nodes,
            ],
        };
    };
}

export default NeurosynthPRISMAHelper;
