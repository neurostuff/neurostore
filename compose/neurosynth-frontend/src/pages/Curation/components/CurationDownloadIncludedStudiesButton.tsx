import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Box, Button, ButtonGroup, MenuItem, MenuList } from '@mui/material';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import ProgressLoader from 'components/ProgressLoader';
import { useProjectCurationColumns, useProjectName } from 'pages/Project/store/ProjectStore';
import { useRef, useState } from 'react';
import { downloadFile } from '../Curation.helpers';
import { stubsToBibtex, stubsToCSV } from './CurationDownloadIncludedStudies.helpers';

const CurationDownloadIncludedStudiesButton: React.FC = () => {
    const [optionsIsOpen, setOptionsIsOpen] = useState(false);
    const anchorRef = useRef(null);
    const curationColumns = useProjectCurationColumns();
    const projectName = useProjectName();
    const [isLoading, setIsLoading] = useState(false);

    const handleDownloadIncludedStudies = async (format: 'bibtex' | 'csv') => {
        setIsLoading(true);
        const allIncludedStudies = curationColumns[curationColumns.length - 1];
        const date = new Date().toLocaleDateString();
        if (format === 'bibtex') {
            const bibtexStudies = stubsToBibtex(allIncludedStudies.stubStudies);
            downloadFile(`${projectName}:Curation:${date}.bib`, bibtexStudies, 'text/plain');
        } else {
            const csvStudies = stubsToCSV(allIncludedStudies.stubStudies);
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
            >
                <Box sx={{ width: '252px' }}>
                    <MenuList>
                        <MenuItem onClick={() => handleDownloadIncludedStudies('bibtex')} value="PNG">
                            Download INCLUDED as BibTeX
                        </MenuItem>
                    </MenuList>
                </Box>
            </NeurosynthPopper>
            <ButtonGroup disabled={disable} color="info" ref={anchorRef} sx={{ height: '100%' }} size="small">
                <Button onClick={() => handleDownloadIncludedStudies('csv')}>Download INCLUDED as CSV</Button>
                <Button onClick={() => setOptionsIsOpen(true)} sx={{ width: '44px' }}>
                    {isLoading ? <ProgressLoader size={20} color="secondary" /> : <ArrowDropDownIcon />}
                </Button>
            </ButtonGroup>
        </>
    );
};

export default CurationDownloadIncludedStudiesButton;
