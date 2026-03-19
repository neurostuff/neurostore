import { ArrowDropDown } from '@mui/icons-material';
import { Box, Button, ButtonGroup, ListItem, ListItemText, MenuItem, MenuList } from '@mui/material';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import { EAnalysisType } from 'hooks/projects/Project.types';
import { EImportMode } from 'pages/Curation/Curation.types';
import { useProjectAnalysisType, useProjectId } from 'pages/Project/store/ProjectStore';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const importMethods = [
    {
        label: 'Import via Pubmed ID (PMID) List',
        description: 'Import studies from a list of PubMed IDs',
        href: `import?method=${EImportMode.PUBMED_IMPORT}`,
        value: EImportMode.PUBMED_IMPORT,
    },
    {
        label: 'Import via Sleuth File',
        description: 'Import studies from a sleuth file into your project',
        href: `import?method=${EImportMode.SLEUTH_IMPORT}`,
        value: EImportMode.SLEUTH_IMPORT,
    },
    {
        label: 'Import via Bibliography',
        description: 'Import studies from a bibliography file',
        href: `import?method=${EImportMode.FILE_IMPORT}`,
        value: EImportMode.FILE_IMPORT,
    },
    {
        label: 'Manually create a new study',
        description: 'Manually create a new study',
        href: `import?method=${EImportMode.MANUAL_CREATE}`,
        value: EImportMode.MANUAL_CREATE,
    },
];

const ImportStudiesButton: React.FC = () => {
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [optionsIsOpen, setOptionsIsOpen] = useState(false);
    const projectId = useProjectId();
    const navigate = useNavigate();
    const analysisType = useProjectAnalysisType();

    const handleSearch = () => {
        navigate(
            `/projects/${projectId}/curation/search?dataType=${analysisType === EAnalysisType.IBMA ? 'image' : 'coordinates'}`
        );
    };

    return (
        <>
            <NeurosynthPopper
                placement="bottom-start"
                onClickAway={() => setOptionsIsOpen(false)}
                anchorElement={anchorRef.current}
                open={optionsIsOpen}
            >
                <Box>
                    <MenuList disablePadding>
                        {importMethods.map((method) => (
                            <MenuItem
                                key={method.value}
                                onClick={() => navigate(`/projects/${projectId}/curation/${method.href}`)}
                            >
                                <ListItem>
                                    <ListItemText
                                        primaryTypographyProps={{ variant: 'body2' }}
                                        secondaryTypographyProps={{ variant: 'caption' }}
                                        primary={method.label}
                                        secondary={method.description}
                                    />
                                </ListItem>
                            </MenuItem>
                        ))}
                    </MenuList>
                </Box>
            </NeurosynthPopper>
            <ButtonGroup disableElevation size="small" color="primary" variant="contained">
                <Button
                    ref={anchorRef}
                    onClick={handleSearch}
                    sx={{ fontSize: '12px', borderColor: 'white !important', minWidth: '100px !important' }}
                >
                    Search
                </Button>
                <Button sx={{ width: '44px' }} onClick={() => setOptionsIsOpen(true)}>
                    <ArrowDropDown sx={{ fontSize: '20px' }} />
                </Button>
            </ButtonGroup>
        </>
    );
};

export default ImportStudiesButton;
