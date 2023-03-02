import { Box, Chip, Divider, Paper, Typography } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import TagSelectorPopup from 'components/CurationComponents/SelectorPopups/TagSelectorPopup/TagSelectorPopup';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { ISource, ITag } from 'hooks/requests/useGetProjects';
import { INeurosynthParsedPubmedArticle } from 'hooks/requests/useGetPubMedIds';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import PubMedImportStudySummary from 'components/Dialogs/PubMedImportDialog/PubMedImportStudySummary';
import { ENeurosynthSourceIds } from 'components/ProjectStepComponents/CurationStep/CurationStep';
import React from 'react';

export interface IPubMedWizardTagStep {
    ids: string[];
    stubs: ICurationStubStudy[];
    onChangeStep: (arg: ENavigationButton, stubs: ICurationStubStudy[]) => void;
}

const PubMedWizardTagStep: React.FC<
    IPubMedWizardTagStep & {
        queryResults: INeurosynthParsedPubmedArticle[][];
        isLoading: boolean;
        isError: boolean;
    }
> = (props) => {
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);

    useEffect(() => {
        if (props.stubs && props.stubs.length > 0) {
            setStubs(props.stubs);
        } else if (props.queryResults && props.queryResults.length > 0) {
            const transformedData = props.queryResults.flat();

            setStubs(
                transformedData.map((x) => {
                    const authorString = (x?.authors || []).reduce(
                        (prev, curr, index, arr) =>
                            `${prev}${curr.ForeName} ${curr.LastName}${
                                index === arr.length - 1 ? '' : ', '
                            }`,
                        ''
                    );

                    const keywordsString = (x?.keywords || []).reduce((acc, curr, currIndex) => {
                        if (currIndex === 0) {
                            return curr;
                        } else {
                            return `${acc}, ${curr}`;
                        }
                    }, '');

                    const pubmedIdentificationSource: ISource = {
                        id: ENeurosynthSourceIds.PUBMED,
                        label: 'PubMed',
                    };

                    return {
                        id: uuidv4(),
                        title: x.title,
                        authors: authorString,
                        keywords: keywordsString,
                        pmid: x.PMID,
                        doi: x.DOI,
                        journal: x.journal.title,
                        articleYear: x.articleYear,
                        abstractText: x.abstractText,
                        articleLink: x.articleLink,
                        exclusionTag: null,
                        tags: [],
                        identificationSource: pubmedIdentificationSource,
                    };
                })
            );
        }
    }, [props.queryResults, props.stubs]);

    const handleAddTag = (tag: ITag) => {
        setStubs((prev) => {
            // check if tag exists already and if so, don't add it
            if (prev.length > 0 && prev[0].tags.findIndex((x) => x.id === tag.id) >= 0) {
                return prev;
            }

            const updatedStubs = [...prev];
            updatedStubs.forEach((stub) => {
                stub.tags = [...stub.tags, tag];
            });
            return updatedStubs;
        });
    };

    const handleDeleteTag = (tag: ITag) => {
        setStubs((prev) => {
            const updatedStubs = [...prev];
            updatedStubs.forEach((stub) => {
                stub.tags = stub.tags.filter((x) => x.id !== tag.id);
            });
            return updatedStubs;
        });
    };

    const tags = stubs.length > 0 ? stubs[0].tags : [];

    return (
        <>
            <StateHandlerComponent isLoading={props.isLoading} isError={props.isError}>
                <Typography gutterBottom sx={{ fontWeight: 'bold' }} variant="h6">
                    Importing {stubs.length} articles from pubmed
                </Typography>
                <Paper
                    elevation={0}
                    sx={{ position: 'sticky', top: 0, zIndex: 999, margin: '2rem 0' }}
                >
                    <Typography sx={{ marginBottom: '0.5rem' }} variant="body1">
                        Tag all your imported studies
                    </Typography>
                    <Box>
                        <TagSelectorPopup
                            sx={{ width: '380px' }}
                            onAddTag={handleAddTag}
                            onCreateTag={handleAddTag}
                        />
                        <Box sx={{ marginTop: '1rem' }}>
                            {tags.map((tag) => (
                                <Chip
                                    sx={{ margin: '3px' }}
                                    onDelete={() => handleDeleteTag(tag)}
                                    label={tag.label}
                                    key={tag.id}
                                />
                            ))}
                        </Box>
                    </Box>
                    <Divider sx={{ marginTop: '1rem' }} />
                </Paper>
                <Box>
                    {stubs.map((stub, index) => (
                        <PubMedImportStudySummary key={stub.id} {...stub} />
                    ))}
                </Box>
            </StateHandlerComponent>
            <Paper elevation={0} sx={{ position: 'sticky', bottom: '-20px', padding: '1rem 0' }}>
                <NavigationButtons
                    nextButtonStyle="contained"
                    onButtonClick={(button) => props.onChangeStep(button, stubs)}
                />
            </Paper>
        </>
    );
};

export default PubMedWizardTagStep;
