import {
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import React, { useEffect, useState } from 'react';
import { Image, ReadOnly } from '../../gen/api';
import { Box } from '@mui/system';

export interface DisplayImagesTableModel {
    images: (Image & ReadOnly)[] | undefined;
    onSelectImage: (selectedImage: Image & ReadOnly) => void;
}

const DisplayImagesTable: React.FC<DisplayImagesTableModel> = (props) => {
    const [currentSelectedImage, setCurrentSelectedImage] = useState<
        (Image & ReadOnly) | undefined
    >();

    useEffect(() => {
        const images = props.images as (Image & ReadOnly)[];
        if (!images || images.length === 0) {
            // images does not exist or is empty
            setCurrentSelectedImage(undefined);
        } else if (images.length === 1) {
            // only one image
            setCurrentSelectedImage(images[0]);
        } else {
            // multiple images.
            // loop through and find the first image that has a T value type.
            // if none found, just display the first image
            let currentImage = images[0];
            for (let i = 0; i < images.length; i++) {
                if (images[i].value_type === 'T') {
                    currentImage = images[i];
                    break;
                }
            }
            setCurrentSelectedImage(currentImage);
        }
    }, [props.images]);

    if (!props || props.images?.length === 0) {
        return (
            <Box component="span" sx={{ color: 'warning.dark' }}>
                No images
            </Box>
        );
    }

    return (
        <TableContainer>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell></TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Space</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    <TableRow>
                        <TableCell>
                            <IconButton>
                                <KeyboardArrowDownIcon />
                            </IconButton>
                        </TableCell>
                        <TableCell>data</TableCell>
                        <TableCell>here</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>
                            <IconButton>
                                <KeyboardArrowDownIcon />
                            </IconButton>
                        </TableCell>
                        <TableCell>data</TableCell>
                        <TableCell>here</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>
                            <IconButton>
                                <KeyboardArrowDownIcon />
                            </IconButton>
                        </TableCell>
                        <TableCell>data</TableCell>
                        <TableCell>here</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default DisplayImagesTable;
