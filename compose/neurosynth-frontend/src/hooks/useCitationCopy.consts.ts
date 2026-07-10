export type CitationInfo = {
    key: 'neurosynth_compose' | 'nimare';
    doi: string;
    doiUrl: string;
    apaText: string;
};

export type CitationFormat = 'apa' | 'vancouver' | 'harvard1' | 'bibtex';

export const FORMAT_LABELS: Record<CitationFormat, string> = {
    apa: 'APA',
    bibtex: 'BibTeX',
    vancouver: 'Vancouver',
    harvard1: 'Harvard',
};

export const NEUROSYNTH_COMPOSE_CITATION: CitationInfo = {
    key: 'neurosynth_compose',
    doi: '10.1162/IMAG.a.1114',
    doiUrl: 'https://doi.org/10.1162/IMAG.a.1114',
    apaText:
        'Kent, J. D., Lee, N., Laird, A. R., Salo, T., Peraza, J., Bottenhorn, K. L., Oudyk, K., Nichols, T. E., Poline, J.-B., & de la Vega, A. (2026). Neurosynth Compose: A web-based platform for flexible and reproducible neuroimaging meta-analysis. Imaging Neuroscience, 4.',
};

export const NIMARE_CITATION: CitationInfo = {
    key: 'nimare',
    doi: '10.52294/001c.87681',
    doiUrl: 'https://doi.org/10.52294/001c.87681',
    apaText:
        'Salo, T., Yarkoni, T., Nichols, T. E., Poline, J.-B., Bilgel, M., Bottenhorn, K. L., Eickhoff, S. B., Jarecka, D., Kent, J. D., Kimbler, A., Nielson, D. M., Oudyk, K. M., Peraza, J. A., Perez, A., Reeders, P. C., Yanes, J. A., & Laird, A. R. (2023). NiMARE: Neuroimaging Meta-Analysis Research Environment. Aperture Neuro, 3.',
};

export const PRIMARY_CITATIONS: CitationInfo[] = [NEUROSYNTH_COMPOSE_CITATION, NIMARE_CITATION];

export const CITATION_DOIS = PRIMARY_CITATIONS.map((citation) => citation.doi);

export const APA_CITATIONS_TEXT = PRIMARY_CITATIONS.map((citation) => `${citation.apaText} ${citation.doiUrl}`).join(
    '\n\n'
);
