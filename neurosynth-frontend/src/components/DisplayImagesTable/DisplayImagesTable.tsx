import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useEffect, useState } from 'react';
import { Image, ReadOnly } from '../../gen/api';
import { Box } from '@mui/system';
import DisplayImagesTableRow from './DisplayImageTableRow/DisplayImagesTableRow';
import { DisplayImagesTableModel } from '.';

const DisplayImagesTable: React.FC<DisplayImagesTableModel> = (props) => {
    const [currentSelectedImage, setCurrentSelectedImage] = useState<
        (Image & ReadOnly) | undefined
    >();

    useEffect(() => {
        setCurrentSelectedImage(props.initialSelectedImage);
    }, [props.initialSelectedImage]);

    const handleRowSelect = (selectedImage: (Image & ReadOnly) | undefined) => {
        setCurrentSelectedImage(selectedImage);
        props.onSelectImage(selectedImage);
    };

    if (!props || !props.images || props.images.length === 0) {
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
                    {props &&
                        props.images.map((image) => (
                            <DisplayImagesTableRow
                                key={image.id}
                                image={image}
                                onRowSelect={handleRowSelect}
                                active={currentSelectedImage?.id === image.id || false}
                            />
                        ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default DisplayImagesTable;
