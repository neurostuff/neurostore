import { Link, LinkProps } from '@mui/material';

const GLOSSARY_URL = 'https://neurostuff.github.io/compose-docs/guide/glossary';

function GlossaryLink({ hash, children, ...linkProps }: { hash: string } & Omit<LinkProps, 'href'>) {
    return (
        <Link underline="hover" target="_blank" rel="noreferrer" {...linkProps} href={`${GLOSSARY_URL}#${hash}`}>
            {children}
        </Link>
    );
}

export default GlossaryLink;
