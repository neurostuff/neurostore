import { Button, Typography } from '@mui/material';
import { Box, SxProps, Theme } from '@mui/system';
import React, { useEffect, useRef, useState } from 'react';

const TextExpansion: React.FC<{ text: string; sx?: SxProps<Theme> }> = (props) => {
    const [expanded, setExpanded] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const textRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (textRef.current) {
            // offset width is the width taken up by the span element
            // scrollWidth is the minimum width span element would require without using the horizontal scrollbar
            const hasOverflow = textRef.current.offsetWidth < textRef.current.scrollWidth;
            setIsOverflowing(hasOverflow);
        }
    }, [props.text]);

    return (
        <Box sx={{ ...props.sx }}>
            <Typography ref={textRef} noWrap={!expanded}>
                {props.text}
            </Typography>
            {/* only show button if the element is overflowing */}
            {isOverflowing && (
                <Button
                    sx={{ paddingLeft: 0, paddingTop: 0 }}
                    color="secondary"
                    onClick={() => {
                        setExpanded(!expanded);
                    }}
                >
                    {expanded ? 'Read Less' : 'Read More'}
                </Button>
            )}
        </Box>
    );
};

export default TextExpansion;
