import { vi, Mock } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import CurationDownloadIncludedStudiesButton from 'pages/Curation/components/CurationDownloadIncludedStudiesButton';
import userEvent from '@testing-library/user-event';
import { useProjectCurationColumns } from 'pages/Project/store/ProjectStore';
import { ICurationColumn } from '../Curation.types';
import { defaultIdentificationSources } from 'pages/Project/store/ProjectStore.types';
import { downloadFile } from '../Curation.helpers';

vi.mock('react-query');
vi.mock('pages/Curation/Curation.helpers.ts', () => ({
    downloadFile: vi.fn(),
}));
vi.mock('pages/Project/store/ProjectStore');

const mockCurationColumns: ICurationColumn[] = [
    {
        name: 'excluded',
        id: '1',
        stubStudies: [],
    },
    {
        name: 'included',
        id: '2',
        stubStudies: [
            {
                id: 'included_1',
                title: 'included_1',
                authors: 'John Smith',
                pmid: 'included_pmid_1',
                pmcid: 'included_pmcid_1',
                doi: 'included_doi_1',
                articleYear: 'included_articleyear_1',
                journal: 'included_journal_1',
                articleLink: 'included_articlelink_1',
                tags: [],
                identificationSource: defaultIdentificationSources.neurostore,
                keywords: '',
                abstractText: 'included_abstract_1',
                exclusionTag: null,
                neurostoreId: 'included_neurostoreid_1',
            },
            {
                id: 'included_2',
                title: 'included_2',
                authors: 'included_authors_2',
                pmid: 'included_pmid_2',
                pmcid: 'included_pmcid_2',
                doi: '',
                articleYear: 'included_articleyear_2',
                journal: 'included_journal_2',
                articleLink: 'included_articlelink_2',
                tags: [
                    {
                        id: 'tag_1',
                        label: 'tag_1_label',
                        isExclusionTag: false,
                        isAssignable: true,
                    },
                    {
                        id: 'tag_2',
                        label: 'tag_2_label',
                        isExclusionTag: false,
                        isAssignable: true,
                    },
                ],
                identificationSource: defaultIdentificationSources.neurostore,
                keywords: '',
                abstractText: 'included_abstract_2',
                exclusionTag: null,
                neurostoreId: 'included_neurostoreid_2',
            },
        ],
    },
];

describe('CurationDownloadIncludedStudiesButton', () => {
    it('should render', () => {
        (useProjectCurationColumns as Mock).mockReturnValue(mockCurationColumns);
        render(<CurationDownloadIncludedStudiesButton />);
    });

    it('should be disabled if there are no included studies', () => {
        (useProjectCurationColumns as Mock).mockReturnValue([
            { name: 'excluded', id: '1', stubStudies: [] },
            { name: 'included', id: '1', stubStudies: [] },
        ]);
        render(<CurationDownloadIncludedStudiesButton />);
        const downloadButton = screen.getByText('Download INCLUDED as CSV');
        expect(downloadButton).toBeDisabled();
    });

    it('renders the button group and opens the dropdown menu when clicked', () => {
        (useProjectCurationColumns as Mock).mockReturnValue(mockCurationColumns);
        render(<CurationDownloadIncludedStudiesButton />);
        const dropdownButton = screen.getByTestId('ArrowDropDownIcon');
        expect(dropdownButton).toBeInTheDocument();
        expect(screen.getByText('Download INCLUDED as CSV')).toBeInTheDocument();
        userEvent.click(dropdownButton);
        expect(screen.getByRole('menuitem', { name: 'Download INCLUDED as BibTeX' })).toBeInTheDocument();
    });

    it('downloads CSVs when the download CSV button is clicked', () => {
        const csvStudies =
            `"Title","Authors","PMID","PMCID","DOI","Year","Journal","Link","Source","Tags","Neurosynth ID","Search Term"\r\n` +
            `"included_1","John Smith","included_pmid_1","included_pmcid_1","included_doi_1","included_articleyear_1","included_journal_1","included_articlelink_1","Neurostore","","included_neurostoreid_1",""\r\n` +
            `"included_2","included_authors_2","included_pmid_2","included_pmcid_2","","included_articleyear_2","included_journal_2","included_articlelink_2","Neurostore","tag_1_label,tag_2_label","included_neurostoreid_2",""`;

        (useProjectCurationColumns as Mock).mockReturnValue(mockCurationColumns);

        render(<CurationDownloadIncludedStudiesButton />);
        userEvent.click(screen.getByText('Download INCLUDED as CSV'));
        expect(downloadFile).toHaveBeenCalledTimes(1);
        expect(downloadFile).toHaveBeenCalledWith(
            `project-name:Curation:${new Date().toLocaleDateString()}.csv`,
            csvStudies,
            'text/csv;charset=utf-8'
        );
    });

    it('downloads BibTeX citations when the download BibTeX button is clicked', async () => {
        const expectedBibtex =
            `@article{Smithincluded_1,\n` +
            `\tauthor = {Smith, John},\n` +
            `\tjournal = {included\\textunderscore{}journal\\textunderscore{}1},\n` +
            `\tdoi = {included_doi_1},\n` +
            `\tnote = {PMID: included\\textunderscore{}pmid\\textunderscore{}1; PMCID: included\\textunderscore{}pmcid\\textunderscore{}1; Neurosynth ID: included\\textunderscore{}neurostoreid\\textunderscore{}1; Source: Neurostore},\n` +
            `\ttitle = {included\\textunderscore{}1},\n` +
            `\turl = {included_articlelink_1},\n` +
            `\thowpublished = {included\\textunderscore{}articlelink\\textunderscore{}1},\n` +
            `}\n` +
            `@article{included_2,\n` +
            `\tauthor = {, included\\textunderscore{}authors\\textunderscore{}2},\n` +
            `\tjournal = {included\\textunderscore{}journal\\textunderscore{}2},\n` +
            `\tdoi = {},\n` +
            `\tnote = {PMID: included\\textunderscore{}pmid\\textunderscore{}2; PMCID: included\\textunderscore{}pmcid\\textunderscore{}2; Neurosynth ID: included\\textunderscore{}neurostoreid\\textunderscore{}2; Source: Neurostore; Tags: tag\\textunderscore{}1\\textunderscore{}label,tag\\textunderscore{}2\\textunderscore{}label},\n` +
            `\ttitle = {included\\textunderscore{}2},\n` +
            `\turl = {included_articlelink_2},\n` +
            `\thowpublished = {included\\textunderscore{}articlelink\\textunderscore{}2},\n` +
            `}\n\n`;

        (useProjectCurationColumns as Mock).mockReturnValue(mockCurationColumns);

        await act(async () => {
            render(<CurationDownloadIncludedStudiesButton />);
            const dropdownButton = screen.getByTestId('ArrowDropDownIcon');
            expect(dropdownButton).toBeInTheDocument();
            userEvent.click(dropdownButton);
        });
        await act(async () => {
            userEvent.click(screen.getByText('Download INCLUDED as BibTeX'));
        });
        expect(downloadFile).toHaveBeenCalledWith(
            `project-name:Curation:${new Date().toLocaleDateString()}.bib`,
            expectedBibtex,
            'text/plain'
        );
    });
});
