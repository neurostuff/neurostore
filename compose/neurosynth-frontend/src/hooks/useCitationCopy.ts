import { CITATION_DOIS, CitationFormat, FORMAT_LABELS } from 'hooks/useCitationCopy.consts';
import { useSnackbar } from 'notistack';
import { useQuery } from 'react-query';
import useCopyToClipboard from './useCopyToClipboard';

const useCitation = () => {
    return useQuery(
        'citationPayload',
        async () => {
            // @ts-expect-error citation-js packages do not provide first-party TS types
            const citationCore = await import('@citation-js/core');
            // @ts-expect-error citation-js packages do not provide first-party TS types
            await import('@citation-js/plugin-bibtex');
            // @ts-expect-error citation-js packages do not provide first-party TS types
            await import('@citation-js/plugin-csl');
            // @ts-expect-error citation-js packages do not provide first-party TS types
            await import('@citation-js/plugin-doi');

            const citations = await citationCore.Cite.async(CITATION_DOIS);
            return {
                apa: String(
                    citations.format('bibliography', { format: 'text', template: 'apa', lang: 'en-US' })
                ).trim(),
                vancouver: String(
                    citations.format('bibliography', { format: 'text', template: 'vancouver', lang: 'en-US' })
                ).trim(),
                harvard1: String(
                    citations.format('bibliography', { format: 'text', template: 'harvard1', lang: 'en-US' })
                ).trim(),
                bibtex: String(citations.format('bibtex', { format: 'text' })).trim(),
            };
        },
        {
            retry: 3,
            refetchOnWindowFocus: false,
            cacheTime: 1000 * 60 * 60 * 2, // 2 hours
            staleTime: 1000 * 60 * 60 * 2, // 2 hours
        }
    );
};

export const useCitationCopy = () => {
    const { enqueueSnackbar } = useSnackbar();
    const { copyToClipboard } = useCopyToClipboard();
    const { data: citationPayload, isLoading: isCitationLoading } = useCitation();

    const copyCitations = async (format: CitationFormat) => {
        if (!citationPayload) return;
        try {
            await copyToClipboard(citationPayload[format]);
            enqueueSnackbar(`Copied ${FORMAT_LABELS[format]} citations`, { variant: 'success' });
        } catch {
            enqueueSnackbar('Unable to copy citations', { variant: 'error' });
        }
    };

    return { copyCitations, isCitationLoading, citationPayload };
};
