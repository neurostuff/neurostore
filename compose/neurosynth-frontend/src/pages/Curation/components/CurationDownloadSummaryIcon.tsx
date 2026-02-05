import { useProjectCurationColumns, useProjectExclusionTags, useProjectName } from 'pages/Project/store/ProjectStore';
import { useRef, useState } from 'react';
import { stubsToBibtex, stubsToCSV } from './CurationDownloadSummary.helpers';
import { downloadFile } from 'helpers/downloadFile.helpers';
import { Box, IconButton, MenuItem, MenuList } from '@mui/material';
import { Download } from '@mui/icons-material';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import ProgressLoader from 'components/ProgressLoader';

const CurationDownloadIncludedStudiesIcon: React.FC = () => {
    const [optionsIsOpen, setOptionsIsOpen] = useState(false);
    const anchorRef = useRef(null);
    const curationColumns = useProjectCurationColumns();
    const exclusionTags = useProjectExclusionTags();
    const projectName = useProjectName();
    const [isLoading, setIsLoading] = useState(false);

    const handleDownloadIncludedStudies = async (format: 'bibtex' | 'csv') => {
        setIsLoading(true);
        const allIncludedStudies = curationColumns[curationColumns.length - 1];
        const date = new Date().toLocaleDateString();
        if (format === 'bibtex') {
            const bibtexStudies = stubsToBibtex(allIncludedStudies.stubStudies, exclusionTags);
            downloadFile(`${projectName}:Curation:${date}.bib`, bibtexStudies, 'text/plain');
        } else {
            const csvStudies = stubsToCSV(allIncludedStudies.stubStudies, exclusionTags);
            downloadFile(`${projectName}:Curation:${date}.csv`, csvStudies, 'text/csv;charset=utf-8');
        }
        setIsLoading(false);
    };

    const disable =
        curationColumns.length === 0 || curationColumns[curationColumns.length - 1].stubStudies.length === 0;

    return (
        <>
            <NeurosynthPopper
                onClickAway={() => setOptionsIsOpen(false)}
                anchorElement={anchorRef.current}
                open={optionsIsOpen}
                disablePortal={false}
            >
                <Box>
                    <MenuList>
                        <MenuItem onClick={() => handleDownloadIncludedStudies('csv')} value="PNG">
                            Download as CSV
                        </MenuItem>
                        <MenuItem onClick={() => handleDownloadIncludedStudies('bibtex')} value="PNG">
                            Download as BibTeX
                        </MenuItem>
                    </MenuList>
                </Box>
            </NeurosynthPopper>
            {isLoading ? (
                <ProgressLoader size={20} color="secondary" />
            ) : (
                <IconButton
                    disabled={disable}
                    onClick={(event) => {
                        event.stopPropagation();
                        setOptionsIsOpen(true);
                    }}
                    ref={anchorRef}
                >
                    <Download />
                </IconButton>
            )}
        </>
    );
};

export default CurationDownloadIncludedStudiesIcon;
