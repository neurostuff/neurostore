import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Box,
} from '@mui/material';
import { useEffect, useState } from 'react';
import DisplayImagesTableRow from './DisplayImageTableRow/DisplayImageTableRow';
import { DisplayImagesTableModel } from '.';
import { ImageApiResponse } from '../../../utils/api';

const DisplayImagesTable: React.FC<DisplayImagesTableModel> = (props) => {
    const [currentSelectedImage, setCurrentSelectedImage] = useState<
        ImageApiResponse | undefined
    >();

    useEffect(() => {
        setCurrentSelectedImage(props.initialSelectedImage);
    }, [props.initialSelectedImage]);

    const handleRowSelect = (selectedImage: ImageApiResponse | undefined) => {
        setCurrentSelectedImage(selectedImage);
        props.onSelectImage(selectedImage);
    };

    if (!props || !props.images || props.images.length === 0) {
        return (
            <Box component="div" sx={{ color: 'warning.dark', paddingLeft: '15px' }}>
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
