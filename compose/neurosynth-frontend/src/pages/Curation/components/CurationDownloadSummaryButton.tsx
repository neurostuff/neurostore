import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Box, Button, ButtonGroup, ButtonGroupProps, MenuItem, MenuList } from '@mui/material';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import ProgressLoader from 'components/ProgressLoader';
import { useProjectCurationColumns, useProjectName } from 'pages/Project/store/ProjectStore';
import { useRef, useState } from 'react';
import { downloadFile } from '../Curation.helpers';
import { stubsToBibtex, stubsToCSV } from './CurationDownloadSummary.helpers';

const CurationDownloadSummaryButton: React.FC<{
    buttonGroupProps?: ButtonGroupProps;
}> = ({ buttonGroupProps = {} }) => {
    const [optionsIsOpen, setOptionsIsOpen] = useState(false);
    const anchorRef = useRef(null);
    const curationColumns = useProjectCurationColumns();
    const projectName = useProjectName();
    const [isLoading, setIsLoading] = useState(false);

    const handleDownloadIncludedStudies = async (format: 'bibtex' | 'csv') => {
        setIsLoading(true);

        const date = new Date().toLocaleDateString();
        if (format === 'bibtex') {
            const bibtexStudies = stubsToBibtex(curationColumns);
            downloadFile(`${projectName}:Curation:${date}.bib`, bibtexStudies, 'text/plain');
        } else {
            const csvStudies = stubsToCSV(curationColumns);
            downloadFile(`${projectName}:Curation:${date}.csv`, csvStudies, 'text/csv;charset=utf-8');
        }
        setIsLoading(false);
    };

    const disable = curationColumns.length === 0;

    return (
        <>
            <NeurosynthPopper
                onClickAway={() => setOptionsIsOpen(false)}
                anchorElement={anchorRef.current}
                open={optionsIsOpen}
            >
                <Box sx={{ width: '175px' }}>
                    <MenuList>
                        <MenuItem
                            sx={{ fontSize: '12px' }}
                            onClick={() => handleDownloadIncludedStudies('bibtex')}
                            value="PNG"
                        >
                            Download as BibTeX
                        </MenuItem>
                    </MenuList>
                </Box>
            </NeurosynthPopper>
            <ButtonGroup disabled={disable} color="info" ref={anchorRef} size="small" {...buttonGroupProps}>
                <Button sx={{ fontSize: '12px' }} onClick={() => handleDownloadIncludedStudies('csv')}>
                    Download as CSV
                </Button>
                <Button sx={{ fontSize: '12px', width: '44px' }} onClick={() => setOptionsIsOpen(true)}>
                    {isLoading ? (
                        <ProgressLoader size={14} color="secondary" />
                    ) : (
                        <ArrowDropDownIcon sx={{ fontSize: '20px' }} />
                    )}
                </Button>
            </ButtonGroup>
        </>
    );
};

export default CurationDownloadSummaryButton;
