import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import {
    IDuplicateCase,
    IResolveProjectDuplicatesCurationStubStudy,
} from './ResolveProjectDuplicates.types';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { useCallback, useEffect, useState } from 'react';
import { useProjectCurationColumns } from 'pages/Projects/ProjectPage/ProjectStore';
import { flattenColumns } from './ResolveProjectDuplicates.helpers';
import { createDuplicateMap } from '../../helpers/utils';
import { defaultExclusionTags } from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import DuplicateCase from './DuplicateCase';
import CurationImportBaseStyles from '../../CurationImportBase.styles';

const ResolveProjectDuplicates: React.FC<{
    onFinalizeImport: (stubs: ICurationStubStudy[], duplicateCases: IDuplicateCase[]) => void;
    onNavigate: (button: ENavigationButton) => void;
    stubs: ICurationStubStudy[];
}> = (props) => {
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

                let duplicatedStubs: IResolveProjectDuplicatesCurationStubStudy[] | undefined;
                const formattedTitle = importedStub.title.toLocaleLowerCase().trim();
                if (importedStub.doi && duplicateMapping.has(importedStub.doi)) {
                    duplicatedStubs = duplicateMapping.get(importedStub.doi);
                } else if (importedStub.pmid && duplicateMapping.has(importedStub.pmid)) {
                    duplicatedStubs = duplicateMapping.get(importedStub.pmid);
                } else if (importedStub.title && duplicateMapping.has(formattedTitle)) {
                    // in the future, this title search can be replaced with a fuzzier search via a string comparison algorithm
                    duplicatedStubs = duplicateMapping.get(formattedTitle);
                }
                if (duplicatedStubs) {
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

                // update the item being clicked immediately
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

                // if not duplicate is selected, we want to set the other items as duplicate automatically
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

    const handleClickNext = () => {
        props.onFinalizeImport(props.stubs, duplicates);
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

    return (
        <Box sx={{ margin: '1rem 0 6rem 0' }}>
            <Typography variant="h6" sx={{ marginBottom: '1rem', color: 'error.dark' }}>
                {duplicates.length} {duplicates.length > 1 ? 'studies have ' : 'study has '}{' '}
                duplicates that already exist within the project
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
            <Box sx={CurationImportBaseStyles.fixedContainer}>
                <Box sx={CurationImportBaseStyles.fixedButtonsContainer}>
                    <Button
                        variant="outlined"
                        onClick={() => props.onNavigate(ENavigationButton.PREV)}
                    >
                        back
                    </Button>
                    <Button
                        variant="contained"
                        sx={CurationImportBaseStyles.nextButton}
                        disableElevation
                        disabled={!duplicateResolutionComplete}
                        onClick={handleClickNext}
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default ResolveProjectDuplicates;
