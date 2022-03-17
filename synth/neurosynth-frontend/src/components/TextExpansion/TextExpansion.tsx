import { Button, Typography } from '@mui/material';
import { Box, SxProps, Theme } from '@mui/system';
import React, { useEffect, useRef, useState } from 'react';
import TextExpansionStyles from './TextExpansion.styles';

const TextExpansion: React.FC<{ text: string; sx?: SxProps<Theme> }> = (props) => {
    const [expanded, setExpanded] = useState(false);
    const [isOverflowingElement, setIsOverflowing] = useState(false);
    const textRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const handleResize = () => {
            if (textRef.current) {
                // offset width is the width taken up by the span element
                // scrollWidth is the minimum width span element would require without using the horizontal scrollbar
                const hasOverflow =
                    textRef.current.offsetWidth < textRef.current.scrollWidth ||
                    textRef.current.offsetHeight < textRef.current.scrollHeight;
                setIsOverflowing(hasOverflow);

                // this is for the edge case where the text is expanded, but resizing the window allows all the text to fit
                // we don't want the READ LESS button to appear
                const textRefStyle = getComputedStyle(textRef.current);
                const textRefLineHeight = textRefStyle.getPropertyValue('line-height');
                const textRefHeight = textRefStyle.getPropertyValue('height');
                if (textRefHeight === textRefLineHeight) setExpanded(false);
            }
        };
        window.addEventListener('resize', handleResize);

        // calculate overflow the first time, and every time expanded changes
        handleResize();

        // remove listeners on cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [props.text, expanded]);

    return (
        <Box component="div" sx={props.sx}>
            <Typography sx={expanded ? {} : TextExpansionStyles.limitToOneLine} ref={textRef}>
                {props.text}
            </Typography>
            {(isOverflowingElement || expanded) && (
                <Button
                    sx={{ padding: 0 }}
                    color="secondary"
                    onClick={() => {
                        setExpanded((prevExpanded) => !prevExpanded);
                    }}
                >
                    {expanded ? 'Read Less' : 'Read More'}
                </Button>
            )}
        </Box>
    );
};

export default TextExpansion;
