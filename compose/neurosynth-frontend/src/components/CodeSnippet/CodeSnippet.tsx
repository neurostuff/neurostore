import { Box, Button } from '@mui/material';
import { useState } from 'react';
import CodeSnippetStyles from './CodeSnippet.styles';

const CodeSnippet: React.FC<{ linesOfCode: string[] }> = (props) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = (_event: React.MouseEvent) => {
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
        <Box sx={[CodeSnippetStyles.codeBlock, { display: 'flex' }]}>
            <Box sx={{ flexGrow: 1 }}>
                {props.linesOfCode.map((code, index) => (
                    <Box key={index} sx={{ marginBottom: '3px', minHeight: '15px' }}>
                        {code}
                    </Box>
                ))}
            </Box>
            <Box>
                <Button onClick={copyToClipboard} disableElevation variant="contained">
                    {copied ? 'copied!' : 'copy'}
                </Button>
            </Box>
        </Box>
    );
};

export default CodeSnippet;
