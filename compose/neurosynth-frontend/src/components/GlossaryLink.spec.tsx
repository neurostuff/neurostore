import { render, screen } from '@testing-library/react';
import GlossaryLink from './GlossaryLink';

describe('GlossaryLink', () => {
    it('links to the compose-docs glossary hash', () => {
        render(<GlossaryLink hash="studyset">studyset</GlossaryLink>);

        const link = screen.getByRole('link', { name: 'studyset' });
        expect(link).toHaveAttribute('href', 'https://neurostuff.github.io/compose-docs/guide/glossary#studyset');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noreferrer');
    });
});
