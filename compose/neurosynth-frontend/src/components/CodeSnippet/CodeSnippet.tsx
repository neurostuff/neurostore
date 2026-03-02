import { ContentCopy } from '@mui/icons-material';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { SystemStyleObject } from '@mui/system';
import useCopyToClipboard from 'hooks/useCopyToClipboard';
import CodeSnippetStyles from './CodeSnippet.styles';

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
                        <Tooltip title="Copy to clipboard">
                            <IconButton
                                size="small"
                                onClick={handleCopyToClipboard}
                                sx={{
                                    color: copied ? 'success.main' : 'white',
                                    fontSize: '16px',
                                    width: '28px',
                                    height: '28px',
                                    ':hover': { backgroundColor: '#717171' },
                                }}
                            >
                                {copied ? '✓' : <ContentCopy sx={{ fontSize: '16px' }} />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </Box>
            <Box sx={{ backgroundColor: '#585858', padding: '0.75rem' }}>
                <Box sx={[CodeSnippetStyles.codeBlock, props.sx ?? {}]} className="sleek-scrollbar">
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
