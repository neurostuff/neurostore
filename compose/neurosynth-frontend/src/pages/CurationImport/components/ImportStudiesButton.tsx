import { ArrowDropDown } from '@mui/icons-material';
import { Box, Button, ButtonProps, ListItem, ListItemText, MenuItem, MenuList } from '@mui/material';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import { useRef, useState } from 'react';
import ImportStudiesDialog from './ImportStudiesDialog';

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

const ImportStudiesButton: React.FC<ButtonProps> = (buttonProps) => {
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [optionsIsOpen, setOptionsIsOpen] = useState(false);
    const [dialogIsOpen, setDialogIsOpen] = useState(false);
    const [method, setMethod] = useState<EImportMode | undefined>(undefined);

    return (
        <>
            <ImportStudiesDialog
                isOpen={dialogIsOpen}
                onCloseDialog={() => {
                    setMethod(undefined); // this is impportant: it resets the method and also hides the reset dialog content
                    setDialogIsOpen(false);
                }}
                method={method}
            />
            <NeurosynthPopper
                placement="bottom-start"
                onClickAway={() => setOptionsIsOpen(false)}
                anchorElement={anchorRef.current}
                open={optionsIsOpen}
            >
                <Box sx={{ width: '100%' }}>
                    <MenuList disablePadding>
                        {importMethods.map((method) => (
                            <MenuItem
                                key={method.value}
                                onClick={() => {
                                    if (!method) return;
                                    setOptionsIsOpen(false);
                                    setDialogIsOpen(true);
                                    setMethod(method.value);
                                }}
                            >
                                <ListItemText
                                    primaryTypographyProps={{ variant: 'body2' }}
                                    secondaryTypographyProps={{ variant: 'caption' }}
                                    primary={method.label}
                                    secondary={method.description}
                                />
                            </MenuItem>
                        ))}
                    </MenuList>
                </Box>
            </NeurosynthPopper>
            <Button
                ref={anchorRef}
                disableElevation
                onClick={() => setOptionsIsOpen(true)}
                variant="outlined"
                size="small"
                color="primary"
                sx={{ fontSize: '12px', minWidth: '140px !important' }}
                {...buttonProps}
            >
                Import Studies
                <ArrowDropDown sx={{ fontSize: '20px', marginLeft: '4px' }} />
            </Button>
        </>
    );
};

export default ImportStudiesButton;
