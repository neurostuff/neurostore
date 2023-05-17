import {
    Box,
    Button,
    ButtonGroup,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    MenuList,
    Typography,
} from '@mui/material';
import PrismaComponent from 'components/PrismaComponent/PrismaComponent';
import CloseIcon from '@mui/icons-material/Close';
import { IDialog } from '../BaseDialog';
import { toSvg, toPng, toJpeg } from 'html-to-image';
import { useRef, useState } from 'react';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Options } from 'html-to-image/lib/types';

const PrismaDialog: React.FC<IDialog> = (props) => {
    const [optionsIsOpen, setOptionsIsOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState<'SVG' | 'PNG' | 'JPEG'>('SVG');
    const handleCloseDialog = () => {
        props.onCloseDialog();
    };
    const anchorRef = useRef<any>(null);

    const download = (data: string, extension: 'svg' | 'png' | 'jpeg') => {
        const link = document.createElement('a');
        link.download = `PRISMA.${extension}`;
        link.href = data;
        link.click();
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        const options: Options = {
            quality: 1,
            backgroundColor: 'white',
            filter: (node) => {
                if (
                    node?.classList?.contains('react-flow__minimap') ||
                    node?.classList?.contains('react-flow__controls') ||
                    node?.classList?.contains('react-flow__panel')
                ) {
                    // prevent image from including the minimap or zoom controls
                    return false;
                }
                return true;
            },
        };

        switch (selectedOption) {
            case 'SVG':
                toSvg(document.querySelector('.react-flow') as HTMLElement, options)
                    .then((data) => {
                        download(data, 'svg');
                    })
                    .catch((err) => {
                        console.error(err);
                    });
                break;
            case 'JPEG':
                toJpeg(document.querySelector('.react-flow') as HTMLElement, options)
                    .then((data) => {
                        download(data, 'jpeg');
                    })
                    .catch((err) => {
                        console.error(err);
                    });
                break;
            case 'PNG':
                toPng(document.querySelector('.react-flow') as HTMLElement, options)
                    .then((data) => {
                        download(data, 'png');
                    })
                    .catch((err) => {
                        console.error(err);
                    });
                break;
        }
    };

    const handleMenuItemSelected = (val: 'SVG' | 'PNG' | 'JPEG') => {
        setOptionsIsOpen(false);
        setSelectedOption(val);
    };

    return (
        <Dialog fullWidth maxWidth="md" open={props.isOpen} onClose={handleCloseDialog}>
            <DialogTitle sx={{ display: 'flex' }}>
                <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center' }}>
                    <Typography variant="h6">PRISMA Diagram</Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                    <NeurosynthPopper
                        onClickAway={() => setOptionsIsOpen(false)}
                        anchorElement={anchorRef.current}
                        open={optionsIsOpen}
                    >
                        <Box sx={{ width: '318px' }}>
                            <MenuList>
                                <MenuItem onClick={() => handleMenuItemSelected('SVG')} value="SVG">
                                    SVG
                                </MenuItem>
                                <MenuItem onClick={() => handleMenuItemSelected('PNG')} value="PNG">
                                    PNG
                                </MenuItem>
                                <MenuItem
                                    onClick={() => handleMenuItemSelected('JPEG')}
                                    value="JPEG"
                                >
                                    JPEG
                                </MenuItem>
                            </MenuList>
                        </Box>
                    </NeurosynthPopper>
                    <ButtonGroup sx={{ marginRight: '15px' }} ref={anchorRef}>
                        <Button size="small" onClick={handleClick}>
                            Download PRISMA Diagram as {selectedOption}
                        </Button>
                        <Button size="small" onClick={() => setOptionsIsOpen(true)}>
                            <ArrowDropDownIcon />
                        </Button>
                    </ButtonGroup>
                    <IconButton onClick={handleCloseDialog}>
                        <CloseIcon sx={{ fontSize: '2rem' }} />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                <PrismaComponent />
            </DialogContent>
        </Dialog>
    );
};

export default PrismaDialog;
