import { Box, Typography } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationColumn } from 'components/CurationComponents/CurationColumn/CurationColumn';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import {
    useProjectCurationColumns,
    useProjectId,
    useUpdateCurationColumns,
} from 'pages/Projects/ProjectPage/ProjectStore';
import {
    ENeurosynthTagIds,
    defaultExclusionTags,
} from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import React, { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { createDuplicateMap } from '../helpers/utils';
import DuplicateCase from './DuplicateCase/DuplicateCase';

type IResolveProjectDuplicatesCurationStubStudy = ICurationStubStudy & {
    columnIndex?: number;
    studyIndex?: number;
    resolution?: 'duplicate' | 'not-duplicate' | 'resolved';
    colName?: string;
};

const flattenColumns = (cols: ICurationColumn[]): IResolveProjectDuplicatesCurationStubStudy[] => {
    const allStubsInProject: IResolveProjectDuplicatesCurationStubStudy[] = (cols || []).reduce(
        (acc, curr, currIndex) => {
            const convertedStudies = curr.stubStudies.map((study, studyIndex) => {
                const resolutionStr: 'duplicate' | 'not-duplicate' | 'resolved' | undefined =
                    study.exclusionTag
                        ? study.exclusionTag.id === ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID
                            ? 'duplicate'
                            : 'resolved'
                        : undefined;

                return {
                    ...study,
                    columnIndex: currIndex,
                    studyIndex: studyIndex,
                    colName: curr.name,
                    resolution: resolutionStr,
                };
            });

            acc.push(...convertedStudies);

            return acc;
        },
        [] as IResolveProjectDuplicatesCurationStubStudy[] // we need to typecast as typescript infers this type as never[]
    );

    return allStubsInProject;
};

const CurationImportResolveDuplicates: React.FC<{
    stubs: ICurationStubStudy[];
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    const updateCurationColumns = useUpdateCurationColumns();
    const history = useHistory();
    const projectId = useProjectId();
    const [duplicates, setDuplicates] = useState<
        {
            importedStub: ICurationStubStudy & {
                index: number;
                resolution?: 'duplicate' | 'not-duplicate';
            };
            projectDuplicates: IResolveProjectDuplicatesCurationStubStudy[];
        }[]
    >([]);
    const [duplicateResolutionComplete, setDuplicateResolutionComplete] = useState(false);
    const [currStub, setCurrStub] = useState(0);

    const columns = useProjectCurationColumns();

    useEffect(() => {
        const allStubsInProject = flattenColumns(columns);
        const { duplicateMapping } = createDuplicateMap(allStubsInProject);

        setDuplicates((_) => {
            const update: {
                importedStub: ICurationStubStudy & { index: number };
                projectDuplicates: IResolveProjectDuplicatesCurationStubStudy[];
            }[] = [];

            props.stubs.forEach((importedStub, stubIndex) => {
                if (importedStub.exclusionTag !== null) return;

                let key = undefined;
                const formattedTitle = importedStub.title.toLocaleLowerCase().trim();
                if (importedStub.doi && duplicateMapping.has(importedStub.doi)) {
                    key = importedStub.doi;
                } else if (importedStub.pmid && duplicateMapping.has(importedStub.pmid)) {
                    key = importedStub.pmid;
                } else if (importedStub.title && duplicateMapping.has(formattedTitle)) {
                    // in the future, this title search can be replaced with a fuzzier search via a string comparison algorithm
                    key = formattedTitle;
                }
                if (key) {
                    const duplicatedStubs = duplicateMapping.get(
                        key
                    ) as IResolveProjectDuplicatesCurationStubStudy[];
                    update.push({
                        importedStub: {
                            ...importedStub,
                            index: stubIndex,
                        },
                        projectDuplicates: duplicatedStubs,
                    });
                }
            });

            return update;
        });
    }, [columns, props.stubs]);

    const handleOnResolve = useCallback(
        (
            isImportedStub: boolean,
            duplicateCaseIndex: number,
            duplicateStubIndex: number,
            resolution?: 'duplicate' | 'not-duplicate' | undefined
        ) => {
            if (!resolution) return;

            setDuplicates((prev) => {
                const update = [...prev];
                const updatedProjectDuplicates = [...update[duplicateCaseIndex].projectDuplicates];

                if (isImportedStub) {
                    update[duplicateCaseIndex] = {
                        ...update[duplicateCaseIndex],
                        importedStub: {
                            ...update[duplicateCaseIndex].importedStub,
                            resolution: resolution,
                            exclusionTag:
                                resolution === 'duplicate' ? defaultExclusionTags.duplicate : null,
                        },
                    };
                } else {
                    updatedProjectDuplicates[duplicateStubIndex] = {
                        ...updatedProjectDuplicates[duplicateStubIndex],
                        resolution: resolution,
                        exclusionTag:
                            resolution === 'duplicate' ? defaultExclusionTags.duplicate : null,
                    };
                }

                if (resolution === 'not-duplicate') {
                    if (
                        !isImportedStub &&
                        update[duplicateCaseIndex].importedStub.resolution === undefined
                    ) {
                        update[duplicateCaseIndex].importedStub = {
                            ...update[duplicateCaseIndex].importedStub,
                            resolution: 'duplicate',
                            exclusionTag: defaultExclusionTags.duplicate,
                        };
                    }
                    updatedProjectDuplicates.forEach((projectDuplicate, index) => {
                        if (projectDuplicate.resolution === undefined) {
                            updatedProjectDuplicates[index] = {
                                ...updatedProjectDuplicates[index],
                                resolution: 'duplicate',
                                exclusionTag: defaultExclusionTags.duplicate,
                            };
                        }
                    });
                }

                update[duplicateCaseIndex] = {
                    ...update[duplicateCaseIndex],
                    projectDuplicates: updatedProjectDuplicates,
                };

                setDuplicateResolutionComplete((_) => {
                    const allResolved = update.every((duplicateCase) => {
                        const duplicateCaseIsResolved =
                            duplicateCase.importedStub.resolution &&
                            duplicateCase.projectDuplicates.every((x) => x.resolution);
                        return duplicateCaseIsResolved;
                    });
                    return allResolved;
                });

                return update;
            });
        },
        []
    );

    const handleNavigate = (button: ENavigationButton) => {
        if (button === ENavigationButton.PREV) {
            props.onNavigate(button);
        } else {
            // handle import
            const updatedImport = [...props.stubs];
            const updatedColumns = [...columns];

            duplicates.forEach(({ importedStub, projectDuplicates }) => {
                // update the status of the stub being imported
                updatedImport[importedStub.index] = {
                    ...updatedImport[importedStub.index],
                    exclusionTag: importedStub.exclusionTag,
                };

                // update the status of all the duplicates in the project
                projectDuplicates.forEach((projectDuplicateStub) => {
                    if (
                        projectDuplicateStub.columnIndex === undefined ||
                        projectDuplicateStub.studyIndex === undefined
                    ) {
                        return;
                    }

                    const updatedStubStudies = [
                        ...updatedColumns[projectDuplicateStub.columnIndex].stubStudies,
                    ];

                    if (
                        projectDuplicateStub.columnIndex > 0 &&
                        projectDuplicateStub.resolution === 'duplicate'
                    ) {
                        // remove stubs that have already been promoted that the user resolved as a duplicate
                        updatedStubStudies.splice(projectDuplicateStub.studyIndex);
                        const { columnIndex, studyIndex, resolution, colName, ...stub } =
                            projectDuplicateStub;

                        // add the stub back to the first column in order to demote it
                        updatedColumns[0] = {
                            ...updatedColumns[0],
                            stubStudies: [stub, ...updatedColumns[0].stubStudies],
                        };
                    } else {
                        updatedStubStudies[projectDuplicateStub.studyIndex] = {
                            ...updatedStubStudies[projectDuplicateStub.studyIndex],
                            exclusionTag: projectDuplicateStub.exclusionTag,
                        };
                    }

                    updatedColumns[projectDuplicateStub.columnIndex] = {
                        ...updatedColumns[projectDuplicateStub.columnIndex],
                        stubStudies: updatedStubStudies,
                    };
                });
            });

            updatedColumns[0] = {
                ...updatedColumns[0],
                stubStudies: [...updatedImport, ...updatedColumns[0].stubStudies],
            };
            updateCurationColumns(updatedColumns);
            history.push(`/projects/${projectId}/curation`);
        }
    };

    const handleOnExpand = React.useCallback((index: number) => {
        setCurrStub(index);
    }, []);

    const handlePrevOrNextCase = React.useCallback((nav: ENavigationButton) => {
        setCurrStub((prev) => {
            if (nav === ENavigationButton.PREV && prev <= 0) return prev;

            return nav === ENavigationButton.NEXT ? prev + 1 : prev - 1;
        });
    }, []);

    if (duplicates.length === 0) {
        return (
            <Box sx={{ margin: '1rem 0' }}>
                <Typography gutterBottom variant="h6">
                    No duplicates detected between the studies in your import and the studies within
                    your project.
                </Typography>
                <Typography variant="caption" sx={{ color: 'warning.dark' }}>
                    Note: Neurosynth Compose primarily does a quick and simple search for any
                    matching PMIDs, DOIs, or titles that may exist in this project already. This is
                    not a comprehensive search and independent analysis should be done to make sure
                    duplicates are correctly identified.
                </Typography>
                <Box sx={{ marginTop: '1rem' }}>
                    <NavigationButtons onButtonClick={handleNavigate} nextButtonStyle="contained" />
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ margin: '1rem 0' }}>
            <Typography variant="h6" sx={{ marginBottom: '1rem', color: 'error.dark' }}>
                {duplicates.length} {duplicates.length > 1 ? 'studies have ' : 'study has '}{' '}
                potential duplicates that already exist within the project
            </Typography>
            <Typography sx={{ color: 'gray' }}>
                Some studies that you are importing have potential existing duplicates.
            </Typography>
            <Typography gutterBottom sx={{ color: 'gray' }}>
                Resolve below by clicking on the <b>"KEEP THIS STUDY"</b> button for the study that
                you want. Other studies will be marked as duplicates.
            </Typography>

            {duplicates.map(({ importedStub, projectDuplicates }, duplicateCaseIndex) => {
                return (
                    <DuplicateCase
                        key={duplicateCaseIndex}
                        onExpand={handleOnExpand}
                        onResolve={handleOnResolve}
                        onPrevOrNextCase={handlePrevOrNextCase}
                        isExpanded={currStub === duplicateCaseIndex}
                        index={duplicateCaseIndex}
                        importedStub={importedStub}
                        projectDuplicates={projectDuplicates}
                    />
                );
            })}
            <Box sx={{ marginTop: '1rem' }}>
                <NavigationButtons
                    nextButtonStyle="contained"
                    nextButtonDisabled={!duplicateResolutionComplete}
                    nextButtonText="complete import"
                    onButtonClick={handleNavigate}
                />
            </Box>
        </Box>
    );
};

export default CurationImportResolveDuplicates;
