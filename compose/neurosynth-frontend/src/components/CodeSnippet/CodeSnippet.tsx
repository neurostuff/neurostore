import { Box, Button } from '@mui/material';
import { SystemStyleObject } from '@mui/system';
import { useState } from 'react';
import CodeSnippetStyles from './CodeSnippet.styles';

const CodeSnippet: React.FC<{ linesOfCode: string[]; noCopyButton?: boolean; sx?: SystemStyleObject }> = (props) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        setCopied(true);
        const codeString = props.linesOfCode.reduce((prev, curr, index) => {
            return index === 0 ? curr : `${prev}\n${curr}`;
        }, '');
        navigator.clipboard.writeText(codeString);
        setTimeout(() => {
            setCopied(false);
        }, 2000);
    };

    return (
        <Box sx={[CodeSnippetStyles.codeBlock, { display: 'flex', flexWrap: 'wrap' }, props.sx ?? {}]}>
            <Box sx={{ flexGrow: 1 }}>
                {props.linesOfCode.map((code, index) => (
                    <Box key={index} sx={{ marginBottom: '3px', minHeight: '15px' }}>
                        {code}
                    </Box>
                ))}
            </Box>
            {!props.noCopyButton && (
                <Box>
                    <Button onClick={copyToClipboard} disableElevation variant="contained">
                        {copied ? 'copied!' : 'copy'}
                    </Button>
                </Box>
            )}
        </Box>
    );
};

export default CodeSnippet;
