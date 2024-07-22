import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SchemaIcon from '@mui/icons-material/Schema';
import { Box, Button, ButtonGroup, MenuItem, MenuList } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import ProjectIsLoadingText from 'components/ProjectIsLoadingText';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import GlobalStyles from 'global.styles';
import { useGetCurationSummary, useGetStudysetById } from 'hooks';
import useUserCanEdit from 'hooks/useUserCanEdit';
import CurationBoard from 'pages/Curation/components/CurationBoard';
import PrismaDialog from 'pages/Curation/components/PrismaDialog';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import {
    useInitProjectStoreIfRequired,
    useProjectCurationColumns,
    useProjectCurationIsPrisma,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectName,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { stringToNumber } from 'pages/SleuthImport/SleuthImport.helpers';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
const Cite = require('citation-js');
// const bibtexPlugin = require('@citation-js/plugin-bibtex');
// Cite.plugins.add(bibtextPlugin, {
//     output: {
//         type: bib,
//     },
// });

const stringAsAuthorArray = (authors: string): IBibtex['author'] => {
    const authorsStringToArray = authors.split(', ').map((author) => {
        const nameAsArray = author.split(' ');
        if (nameAsArray.length === 0) {
            return { given: '', family: '' };
        } else if (nameAsArray.length === 1) {
            return { given: nameAsArray[0], family: '' };
        } else {
            const givenNames = nameAsArray.slice(0, nameAsArray.length - 1).join(' ');
            return { given: givenNames, family: nameAsArray[nameAsArray.length - 1] };
        }
    });
    return authorsStringToArray;
};

interface IBibtex {
    author: { given: string; family: string }[];
    title: string;
    DOI: string;
    URL: string;
    abstract: string;
    issued: {
        'date-parts': [number, number, number][];
    };
    'container-title': string; // journal
    type: string; // article-journal for papers
}

const CurationPage: React.FC = (props) => {
    const [prismaIsOpen, setPrismaIsOpen] = useState(false);
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const [optionsIsOpen, setOptionsIsOpen] = useState(false);
    const anchorRef = useRef(null);

    useInitProjectStoreIfRequired();

    const navigate = useNavigate();

    const isPrisma = useProjectCurationIsPrisma();
    const includedStudies = useProjectCurationColumns();
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const projectName = useProjectName();
    const { included, uncategorized } = useGetCurationSummary();
    const { data: studyset } = useGetStudysetById(studysetId || '', false);

    const extractionStepInitialized =
        studysetId && annotationId && (studyset?.studies?.length || 0) > 0;

    const handleMoveToExtractionPhase = () => {
        if (extractionStepInitialized) {
            navigate(`/projects/${projectId}/extraction`);
        } else {
            navigate(`/projects/${projectId}`, {
                state: {
                    projectPage: {
                        openCurationDialog: true,
                    },
                } as IProjectPageLocationState,
            });
        }
    };

    const handleDownloadIncludedStudies = (format: 'bibtex' | 'csv') => {
        if (format === 'bibtex') {
            const allIncludedStudies = includedStudies[includedStudies.length - 1];
            const bibtexStudies: IBibtex[] = allIncludedStudies.stubStudies.map((stub) => {
                const { isValid, value } = stringToNumber(stub.articleYear || '');
                return {
                    title: stub.title,
                    DOI: stub.doi || '',
                    URL: stub.articleLink || '',
                    abstract: stub.abstractText || '',
                    issued: {
                        'date-parts': isValid ? [[value, 0, 0]] : [[0, 0, 0]],
                    },
                    'container-title': stub.journal || '',
                    type: 'article-journal',
                    author: stringAsAuthorArray(stub.authors || ''),
                };
            });
            const citeObj = new Cite(bibtexStudies);
            const bibtex = citeObj.format('bibtex') as string;
            // todo: download bibtex
        } else {
            // todo: handle formatting and downloading csv
        }
    };

    const canMoveToExtractionPhase = included > 0 && uncategorized === 0;

    return (
        <StateHandlerComponent isError={false} isLoading={false}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box
                    sx={{
                        display: 'flex',
                        marginBottom: '1rem',
                        justifyContent: 'space-between',
                    }}
                >
                    <Box sx={{ display: 'flex' }}>
                        <NeurosynthBreadcrumbs
                            breadcrumbItems={[
                                {
                                    text: 'Projects',
                                    link: '/projects',
                                    isCurrentPage: false,
                                },
                                {
                                    text: projectName || '',
                                    link: `/projects/${projectId}`,
                                    isCurrentPage: false,
                                },
                                {
                                    text: 'Search & Curate',
                                    link: '',
                                    isCurrentPage: true,
                                },
                            ]}
                        />
                        <ProjectIsLoadingText />
                    </Box>
                    <Box sx={{ marginRight: '1rem' }}>
                        <NeurosynthPopper
                            onClickAway={() => setOptionsIsOpen(false)}
                            anchorElement={anchorRef.current}
                            open={optionsIsOpen}
                        >
                            <Box sx={{ width: '252px' }}>
                                <MenuList>
                                    <MenuItem
                                        onClick={() => handleDownloadIncludedStudies('bibtex')}
                                        value="PNG"
                                    >
                                        Download included as BibTeX
                                    </MenuItem>
                                </MenuList>
                            </Box>
                        </NeurosynthPopper>
                        <ButtonGroup color="info" sx={{ marginRight: '15px' }} ref={anchorRef}>
                            <Button
                                size="small"
                                onClick={() => handleDownloadIncludedStudies('csv')}
                            >
                                Download included as CSV
                            </Button>
                            <Button size="small" onClick={() => setOptionsIsOpen(true)}>
                                <ArrowDropDownIcon />
                            </Button>
                        </ButtonGroup>
                        {isPrisma && (
                            <>
                                <PrismaDialog
                                    onCloseDialog={() => setPrismaIsOpen(false)}
                                    isOpen={prismaIsOpen}
                                />
                                <Button
                                    onClick={() => setPrismaIsOpen(true)}
                                    variant="outlined"
                                    sx={{ marginRight: '1rem', width: '180px' }}
                                    startIcon={<SchemaIcon />}
                                >
                                    PRISMA diagram
                                </Button>
                            </>
                        )}
                        <Button
                            variant="contained"
                            disableElevation
                            sx={{ marginRight: '1rem', width: '180px' }}
                            onClick={() => navigate(`/projects/${projectId}/curation/import`)}
                            disabled={!canEdit}
                        >
                            import studies
                        </Button>
                        {canMoveToExtractionPhase && (
                            <Button
                                onClick={handleMoveToExtractionPhase}
                                variant="contained"
                                color="success"
                                sx={{
                                    width: '234px',
                                    color: 'success.dark',
                                    ml: '2rem',
                                    ...(extractionStepInitialized
                                        ? {
                                              color: 'white',
                                          }
                                        : GlobalStyles.colorPulseAnimation),
                                }}
                                disableElevation
                                disabled={!canEdit}
                            >
                                {extractionStepInitialized
                                    ? 'view extraction'
                                    : 'move to extraction phase'}
                            </Button>
                        )}
                    </Box>
                </Box>
                <Box sx={{ height: '100%', overflow: 'hidden' }}>
                    <CurationBoard />
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};
export default CurationPage;
