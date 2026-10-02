import { Box, Link, Typography } from '@mui/material';
import { SystemStyleObject } from '@mui/system';
import { useEffect, useRef, useState } from 'react';

const TextExpansion = (props: {
    text: string;
    defaultExpanded?: boolean;
    isExpanded?: boolean;
    setIsExpanded?: (expanded: boolean) => void;
    sx?: SystemStyleObject | SystemStyleObject[];
    textSx?: SystemStyleObject;
}) => {
    const [localExpanded, setLocalExpanded] = useState(props.defaultExpanded ?? false);
    const [isOverflowingElement, setIsOverflowing] = useState(false);
    const [fitsOnOneLine, setFitsOnOneLine] = useState(false);
    const textRef = useRef<HTMLElement>(null);
    const isControlled = props.isExpanded !== undefined;
    const expanded = props.isExpanded ?? localExpanded;
    const setExpanded = (nextExpanded: boolean) => {
        if (isControlled) {
            props.setIsExpanded?.(nextExpanded);
            return;
        }
        setLocalExpanded(nextExpanded);
    };

    useEffect(() => {
        const handleResize = () => {
            const textElement = textRef.current;
            if (!textElement) return;

            // offset width is the width taken up by the text element
            // scrollWidth is the minimum width the text element would require without using the horizontal scrollbar
            const hasOverflow =
                textElement.offsetWidth < textElement.scrollWidth ||
                textElement.offsetHeight < textElement.scrollHeight;
            setIsOverflowing(hasOverflow);

            // this is for the edge case where the text is expanded, but all of the text fits on one line
            // we don't want the Read Less link to appear. Don't change the expanded state here: a parent may control it
            const textRefStyle = getComputedStyle(textElement);
            const textRefLineHeight = textRefStyle.getPropertyValue('line-height');
            const textRefHeight = textRefStyle.getPropertyValue('height');
            setFitsOnOneLine(expanded && textRefHeight === textRefLineHeight);
        };
        window.addEventListener('resize', handleResize);

        // calculate overflow the first time, and every time expanded changes
        handleResize();

        // remove listeners on cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [props.text, expanded]);

    const showToggle = isOverflowingElement || (expanded && !fitsOnOneLine);

    const toggleLink = showToggle ? (
        <Link
            component="button"
            type="button"
            color="primary"
            underline="hover"
            onClick={(event) => {
                event.stopPropagation();
                setExpanded(!expanded);
            }}
            sx={[
                props.textSx || {},
                {
                    flexShrink: 0,
                    marginLeft: 0.5,
                    verticalAlign: 'baseline',
                    whiteSpace: 'nowrap',
                },
            ]}
        >
            Read {expanded ? 'less' : 'more'}
        </Link>
    ) : null;

    return (
        <Box
            component="div"
            sx={[
                ...(Array.isArray(props.sx) ? props.sx : [props.sx || {}]),
                { minWidth: 0 },
                !expanded && {
                    display: 'flex',
                    alignItems: 'baseline',
                },
            ]}
        >
            <Typography ref={textRef} noWrap={!expanded} sx={[props.textSx || {}, !expanded && { minWidth: 0 }]}>
                {props.text}
                {expanded && toggleLink}
            </Typography>
            {!expanded && toggleLink}
        </Box>
    );
};

export default TextExpansion;
