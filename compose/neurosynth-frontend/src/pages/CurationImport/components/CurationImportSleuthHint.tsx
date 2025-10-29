import { Alert, Typography } from '@mui/material';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import HelpDialog from 'components/Dialogs/HelpDialog';
import React from 'react';

const hints = [
    {
        instruction:
            'Begin the file with a Reference specifying coordinate space. This should only appear in the file once, at the top.',
        example: '// Reference=MNI',
    },
    {
        instruction:
            'The next line should contain the DOI associated with the study. This field identifies the study that the data came from. At least one of either a DOI or a PubMedId is required.',
        example: '// DOI=10.1016/1234567',
    },
    {
        instruction:
            'The next line should contain the PubMedId associated with the study. This field identifies the study that the data came from. At least one of either a DOI or a PubMedId is required.',
        example: '// PubMedId=67123237',
    },
    {
        instruction: 'The next line should contain the author followed by the experiment, separated by a colon.',
        example: '// Smith et al., 2019: Working Memory vs Baseline',
    },
    {
        instruction: 'The next line should contain the number of subjects.',
        example: '// Subjects=23',
    },
    {
        instruction: 'The following lines should contain the tab separated coordinates',
        example: '-7.5/t-8.5/t-9.5',
    },
    {
        instruction: 'Finally, a newline should be added as a delimiter, separating each of the studies in the file',
        example: '',
    },
];

const CurationImportSleuthHint: React.FC = () => {
    return (
        <HelpDialog dialogTitle="Compatible sleuth files">
            <Typography gutterBottom>Neurosynth Compose expects files in a specific format.</Typography>
            <Typography gutterBottom>
                In order to make sure that the files you upload are compatible, please make sure to format your files
                using the following standards:
            </Typography>

            <ul>
                {hints.map((hint, index) => (
                    <li key={index} style={{ marginBottom: '1rem' }}>
                        {hint.instruction}
                        <br />
                        {hint.example && (
                            <CodeSnippet
                                linesOfCode={[hint.example]}
                                noCopyButton
                                sx={{ marginY: '4px', paddingY: '4px' }}
                            />
                        )}
                    </li>
                ))}
            </ul>

            <Typography mb="1rem">Files should be plain text files with a .txt suffix.</Typography>

            <Alert severity="info" sx={{ marginBottom: '1rem' }}>
                Note: In the example below, the spaces between the coordinates are <b>tabs</b>. Please make sure that
                the sleuth file coordinates are separated by tabs.
            </Alert>

            <Typography gutterBottom>Example: myFile.txt</Typography>
            <CodeSnippet
                linesOfCode={[
                    '// Reference=MNI',
                    '// DOI=10.1016/1234567',
                    '// PubMedId=67123237',
                    '// Smith et al., 2019: Working Memory vs Baseline',
                    '// Subjects=23',
                    '-7.5	-8.5	-9.5',
                    '10	-12	-62',
                    '21	-14	-2',
                    '0	-9	16',
                    '\n',
                    '// DOI=10.217/1234568',
                    '// PubMedId=23782389',
                    '// Roberts et al., 1995: 2 Back vs 1 Back',
                    '// Graeff et al., 2000: 1 Back vs 0 Back',
                    '// Edwards et al., 2017: 2 Back vs 0 Back',
                    `// Subjects=62`,
                    '82	12	0',
                    '-27	34	72',
                    '-7	-8	-9',
                    '10	-12	-62',
                    '\n',
                ]}
            />
        </HelpDialog>
    );
};

export default CurationImportSleuthHint;
