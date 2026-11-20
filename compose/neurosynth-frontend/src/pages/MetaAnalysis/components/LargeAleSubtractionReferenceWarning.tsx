import { Alert, Link, SxProps, Theme } from '@mui/material';

export const ALE_AND_MKDA_BLOG_URL = 'https://neurostuff.github.io/compose-docs/blog/2026/04/14/ale-and-mkda';

const LargeAleSubtractionReferenceWarning = ({ sx }: { sx?: SxProps<Theme> }) => {
    return (
        <Alert severity="warning" sx={[{ marginTop: '1rem' }, ...(Array.isArray(sx) ? sx : [sx])]}>
            Specifying ALE subtraction with a large reference dataset is not recommended.{' '}
            <Link href={ALE_AND_MKDA_BLOG_URL} target="_blank" rel="noopener noreferrer">
                Read more about ALE and MKDA
            </Link>
        </Alert>
    );
};

export default LargeAleSubtractionReferenceWarning;
