import { Box, Button, Typography } from '@mui/material';
import { SystemStyleObject } from '@mui/system';
import CodeSnippetStyles from './CodeSnippet.styles';
import useCopyToClipboard from 'hooks/useCopyToClipboard';

const CodeSnippet: React.FC<{
    linesOfCode: string[];
    noCopyButton?: boolean;
    sx?: SystemStyleObject;
    title?: string;
}> = (props) => {
    const { copied, copyToClipboard } = useCopyToClipboard();

    const handleCopyToClipboard = () => {
        const codeString = props.linesOfCode.reduce((prev, curr, index) => {
            return index === 0 ? curr : `${prev}\n${curr}`;
        }, '');
        copyToClipboard(codeString);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Box sx={CodeSnippetStyles.codeBlockHeader}>
                <Box>
                    <Typography variant="body2">{props.title ?? 'Code Snippet'}</Typography>
                </Box>
                {props.noCopyButton ? null : (
                    <Box>
                        <Button
                            size="small"
                            sx={{ fontSize: '12px', height: '24px', color: copied ? 'success.main' : 'white' }}
                            onClick={handleCopyToClipboard}
                            disableElevation
                            variant="contained"
                        >
                            {copied ? '✓' : 'copy'}
                        </Button>
                    </Box>
                )}
            </Box>
            <Box sx={[CodeSnippetStyles.codeBlock, props.sx ?? {}]}>
                <Box sx={{ whiteSpace: 'nowrap', overflow: 'auto' }} className="sleek-scrollbar">
                    {props.linesOfCode.map((code, index) => (
                        <Box key={index} sx={{ marginBottom: '3px', minHeight: '15px' }}>
                            {code}
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default CodeSnippet;
