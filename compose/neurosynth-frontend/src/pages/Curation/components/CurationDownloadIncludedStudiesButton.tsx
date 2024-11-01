import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Box, Button, ButtonGroup, MenuItem, MenuList } from '@mui/material';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import ProgressLoader from 'components/ProgressLoader';
import { generateBibtex } from 'hooks/external/useGetBibtexCitations';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { useProjectCurationColumns, useProjectName } from 'pages/Project/store/ProjectStore';
import { useRef, useState } from 'react';
import { downloadFile } from '../Curation.helpers';
import * as Cite from '@citation-js/core';
import '@citation-js/plugin-bibtex';
import '@citation-js/plugin-doi';
// require('@citation-js/plugin-bibtex');
// require('@citation-js/plugin-doi');

const CurationDownloadIncludedStudiesButton: React.FC = () => {
    const [optionsIsOpen, setOptionsIsOpen] = useState(false);
    const anchorRef = useRef(null);
    const curationColumns = useProjectCurationColumns();
    const projectName = useProjectName();
    const [isLoading, setIsLoading] = useState(false);

    const retrieveBibtex = (includedStudies: ICurationStubStudy[]) => {
        const responses = includedStudies.map((study) => generateBibtex(study));
        const citeObj = new Cite(responses);
        return citeObj.format('bibtex', { format: 'text' }) as string;
    };

    const retrieveCSV = (studies: ICurationStubStudy[]) => {
        const mappedCSVStudyObjs = studies.map((study) => ({
            title: study.title || '',
            authors: study.authors || '',
            pmid: study.pmid || '',
            pmcid: study.pmcid || '',
            doi: study.doi || '',
            articleYear: study.articleYear || '',
            journal: study.journal || '',
            articleLink: study.articleLink || '',
            source: study.identificationSource.label || '',
            tags: study.tags.reduce(
                (prev, curr, index, arr) =>
                    `${prev}${curr.label}${index === arr.length - 1 ? '' : ','}`,
                ''
            ),
            neurostoreId: study.neurostoreId || '',
            searchTerm: study.searchTerm || '',
        }));

        return [
            {
                title: 'Title',
                authors: 'Authors',
                pmid: 'PMID',
                pmcid: 'PMCID',
                doi: 'DOI',
                articleYear: 'Year',
                journal: 'Journal',
                articleLink: 'Link',
                source: 'Source',
                tags: 'Tags',
                neurostoreId: 'Neurosynth ID',
                searchTerm: 'Search Term',
            },
            ...mappedCSVStudyObjs,
        ]
            .map((study) => {
                const studyValues = Object.values(study); // order is respected
                return studyValues
                    .map(String)
                    .map((value) => value.replaceAll('"', '""'))
                    .map((value) => `"${value}"`)
                    .join(',');
            })
            .join('\r\n');
    };

    const handleDownloadIncludedStudies = async (format: 'bibtex' | 'csv') => {
        setIsLoading(true);
        const allIncludedStudies = curationColumns[curationColumns.length - 1];
        const date = new Date().toLocaleDateString();
        if (format === 'bibtex') {
            const bibtexStudies = retrieveBibtex(allIncludedStudies.stubStudies);
            downloadFile(`${projectName}:Curation:${date}.bib`, bibtexStudies, 'text/plain');
        } else {
            const csvStudies = retrieveCSV(allIncludedStudies.stubStudies);
            downloadFile(
                `${projectName}:Curation:${date}.csv`,
                csvStudies,
                'text/csv;charset=utf-8'
            );
        }
        setIsLoading(false);
    };

    const disable =
        curationColumns.length === 0 ||
        curationColumns[curationColumns.length - 1].stubStudies.length === 0;

    return (
        <>
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
                            Download INCLUDED as BibTeX
                        </MenuItem>
                    </MenuList>
                </Box>
            </NeurosynthPopper>
            <ButtonGroup
                disabled={disable}
                color="info"
                ref={anchorRef}
                sx={{ height: '100%' }}
                size="small"
            >
                <Button onClick={() => handleDownloadIncludedStudies('csv')}>
                    Download INCLUDED as CSV
                </Button>
                <Button onClick={() => setOptionsIsOpen(true)} sx={{ width: '44px' }}>
                    {isLoading ? (
                        <ProgressLoader size={20} color="secondary" />
                    ) : (
                        <ArrowDropDownIcon />
                    )}
                </Button>
            </ButtonGroup>
        </>
    );
};

export default CurationDownloadIncludedStudiesButton;
