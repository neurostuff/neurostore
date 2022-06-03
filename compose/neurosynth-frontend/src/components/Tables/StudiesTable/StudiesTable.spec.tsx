import { useAuth0 } from '@auth0/auth0-react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router } from 'react-router-dom';
import { StudiesTable } from '..';
import { MockThemeProvider } from 'testing/helpers';
import API, { StudyApiResponse, StudysetsApiResponse } from 'utils/api';
import { SnackbarProvider } from 'notistack';

jest.mock('hooks');
jest.mock('@auth0/auth0-react');
jest.mock('utils/api');
jest.mock('components/StudysetsPopupMenu/StudysetsPopupMenu');

describe('StudiesTable Component', () => {
    const historyMock = {
        push: jest.fn(),
        location: {},
        listen: jest.fn(),
    };

    const mockStudies: StudyApiResponse[] = [
        {
            analyses: ['5CgFrbqVsKsH', '4TType6JzACT', '3qgrMH6Etutw'],
            authors:
                "Robert M. Mok, M. Clare O'Donoguhue, Nicholas E. Myers, Erin H.S. Drazich and Anna C. Nobre",
            created_at: '2021-09-14T16:01:55.799028+00:00',
            description:
                "fMRI study: selective working memory in aging\r\n\r\nMok et al (2019), Neural markers of category-based selective working memory in aging. NeuroImage.\r\nAuthors: Robert M Mok, M. Clare O'Donoghue, Nicholas E Myers, Erin H.S. Drazich, Anna Christina Nobre \r\n\r\nPublished manuscript: https://www.sciencedirect.com/science/article/pii/S1053811919302228\r\n\r\nPreprint: https://www.biorxiv.org/content/early/2018/10/05/435388\r\ndoi: https://doi.org/10.1101/435388\r\n\r\n",
            doi: '10.1016/j.neuroimage.2019.03.033',
            id: '5LMdXPD3ocgD',
            metadata: {},
            name: 'Neural markers of category-based selective working memory in aging',
            pmid: null,
            publication: 'NeuroImage',
            source: 'neurovault',
            source_id: '4742',
            source_updated_at: null,
            user: null,
        },
        {
            analyses: ['5TYEtvBFrgMk', '5gMbJgyu3Puv', '7QhXDMHBBWWF'],
            authors:
                'Konstantinos Bromis, Maria Calem, Antje A.T.S. Reinders, Steven C.R. Williams and Matthew J. Kempton',
            created_at: '2021-09-14T15:58:25.930306+00:00',
            description:
                "OBJECTIVE:\r\nThe authors conducted a comprehensive meta-analysis of MRI region-of-interest and voxel-based morphometry (VBM) studies in posttraumatic stress disorder (PTSD). Because patients have high rates of comorbid depression, an additional objective was to compare the findings to a meta-analysis of MRI studies in depression.\r\n\r\nMETHOD:\r\nThe MEDLINE database was searched for studies from 1985 through 2016. A total of 113 studies met inclusion criteria and were included in an online database. Of these, 66 were selected for the region-of-interest meta-analysis and 13 for the VBM meta-analysis. The region-of-interest meta-analysis was conducted and compared with a meta-analysis of major depressive disorder. Within the region-of-interest meta-analysis, three subanalyses were conducted that included control groups with and without trauma.\r\n\r\nRESULTS:\r\nIn the region-of-interest meta-analysis, patients with PTSD compared with all control subjects were found to have reduced brain volume, intracranial volume, and volumes of the hippocampus, insula, and anterior cingulate. PTSD patients compared with nontraumatized or traumatized control subjects showed similar changes. Traumatized compared with nontraumatized control subjects showed smaller volumes of the hippocampus bilaterally. For all regions, pooled effect sizes (Hedges' g) varied from -0.84 to 0.43, and number of studies from three to 41. The VBM meta-analysis revealed prominent volumetric reductions in the medial prefrontal cortex, including the anterior cingulate. Compared with region-of-interest data from patients with major depressive disorder, those with PTSD had reduced total brain volume, and both disorders were associated with reduced hippocampal volume.\r\n\r\nCONCLUSIONS:\r\nThe meta-analyses revealed structural brain abnormalities associated with PTSD and trauma and suggest that global brain volume reductions distinguish PTSD from major depression.",
            doi: '10.1176/appi.ajp.2018.17111199',
            id: '454RhLixbGXR',
            metadata: {},
            name: 'Meta-Analysis of 89 Structural MRI Studies in Posttraumatic Stress Disorder and Comparison With Major Depressive Disorder',
            pmid: null,
            publication: 'American Journal of Psychiatry',
            source: 'neurovault',
            source_id: '4045',
            source_updated_at: null,
            user: null,
        },
    ];

    const mockStudiesNoInfo: StudyApiResponse[] = [
        {
            analyses: [],
            authors: '',
            created_at: '2021-09-14T16:01:55.799028+00:00',
            description: '',
            id: '5LMdXPD3ocgD',
            name: 'some-test-name',
            pmid: null,
            publication: '',
            source: 'neurovault',
            source_id: '4742',
            source_updated_at: null,
            user: null,
        },
    ];

    const mockStudysetsGetPayload: StudysetsApiResponse[] = [
        {
            created_at: '2021-12-14T05:05:45.722157+00:00',
            description: null,
            doi: null,
            id: '123',
            name: 'test-name',
            pmid: null,
            publication: '',
            studies: [],
            user: 'some-user',
        },
    ];

    const mockStudysetsPostResponse: StudysetsApiResponse[] = [
        {
            created_at: '2021-12-14T05:05:45.722157+00:00',
            description: null,
            doi: null,
            id: '123',
            name: 'test-name',
            pmid: null,
            publication: '',
            studies: [],
            user: 'some-user',
        },
    ];

    const mockStudysetsIdPutResponse: StudysetsApiResponse[] = [
        {
            created_at: '2021-12-14T05:05:34.722631+00:00',
            description: null,
            doi: null,
            id: 'test-id',
            name: null,
            pmid: null,
            publication: null,
            studies: ['5LMdXPD3ocgD'],
            user: 'test-user',
        },
    ];

    beforeEach(() => {
        (API.NeurostoreServices.StudySetsService.studysetsGet as any).mockReturnValue(
            Promise.resolve({
                data: {
                    results: mockStudysetsGetPayload,
                },
            })
        );

        (API.NeurostoreServices.StudySetsService.studysetsPost as any).mockReturnValue(
            Promise.resolve({
                data: {
                    results: mockStudysetsPostResponse,
                },
            })
        );

        (API.NeurostoreServices.StudySetsService.studysetsIdPut as any).mockReturnValue(
            Promise.resolve({
                data: {
                    results: mockStudysetsIdPutResponse,
                },
            })
        );

        useAuth0().isAuthenticated = false;
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', async () => {
        useAuth0().isAuthenticated = true;

        await act(async () => {
            render(
                <MockThemeProvider>
                    <SnackbarProvider>
                        <Router history={historyMock as any}>
                            <StudiesTable showStudyOptions={true} studies={mockStudies} />
                        </Router>
                    </SnackbarProvider>
                </MockThemeProvider>
            );
        });

        const rows = screen.getAllByRole('row');

        // subtract 1 to account for the table header
        expect(rows.length - 1).toEqual(mockStudies.length);
        expect(API.NeurostoreServices.StudySetsService.studysetsGet).toHaveBeenCalled();
    });

    it('should show no data', async () => {
        await act(async () => {
            render(
                <MockThemeProvider>
                    <SnackbarProvider>
                        <Router history={historyMock as any}>
                            <StudiesTable studies={[]} />
                        </Router>
                    </SnackbarProvider>
                </MockThemeProvider>
            );
        });
        const noResults = screen.getByText('No data');
        expect(noResults).toBeInTheDocument();
    });

    it('should show no authors available if no authors', async () => {
        await act(async () => {
            render(
                <MockThemeProvider>
                    <SnackbarProvider>
                        <Router history={historyMock as any}>
                            <StudiesTable studies={mockStudiesNoInfo} />
                        </Router>
                    </SnackbarProvider>
                </MockThemeProvider>
            );
        });

        const noAuthorsText = screen.getByText('No Authors Available');
        expect(noAuthorsText).toBeInTheDocument();
    });

    it('should show no publication available if no publication', async () => {
        await act(async () => {
            render(
                <MockThemeProvider>
                    <SnackbarProvider>
                        <Router history={historyMock as any}>
                            <StudiesTable studies={mockStudiesNoInfo} />
                        </Router>
                    </SnackbarProvider>
                </MockThemeProvider>
            );
        });

        const noPublicationText = screen.getByText('No Publication Available');
        expect(noPublicationText).toBeInTheDocument();
    });

    it('should create the studyset', async () => {
        useAuth0().isAuthenticated = true;

        await act(async () => {
            render(
                <MockThemeProvider>
                    <SnackbarProvider>
                        <Router history={historyMock as any}>
                            <StudiesTable showStudyOptions={true} studies={mockStudiesNoInfo} />
                        </Router>
                    </SnackbarProvider>
                </MockThemeProvider>
            );
        });

        const studysetCreatedButton = screen.getByTestId('add-studyset-button');

        await act(async () => {
            userEvent.click(studysetCreatedButton);
        });

        expect(API.NeurostoreServices.StudySetsService.studysetsPost).toBeCalled();
    });

    it('should edit the studyset', async () => {
        useAuth0().isAuthenticated = true;
        await act(async () => {
            render(
                <MockThemeProvider>
                    <SnackbarProvider>
                        <Router history={historyMock as any}>
                            <StudiesTable showStudyOptions={true} studies={mockStudiesNoInfo} />
                        </Router>
                    </SnackbarProvider>
                </MockThemeProvider>
            );
        });

        const studysetEditButton = screen.getByTestId('edit-studyset-button');

        await act(async () => {
            userEvent.click(studysetEditButton);
        });

        expect(API.NeurostoreServices.StudySetsService.studysetsIdPut).toBeCalledWith('123', {
            name: 'test-name',
            studies: ['5LMdXPD3ocgD'],
        });
    });

    it('should handle the selection when the row is clicked', async () => {
        useAuth0().isAuthenticated = true;

        await act(async () => {
            render(
                <MockThemeProvider>
                    <SnackbarProvider>
                        <Router history={historyMock as any}>
                            <StudiesTable showStudyOptions={true} studies={mockStudiesNoInfo} />
                        </Router>
                    </SnackbarProvider>
                </MockThemeProvider>
            );
        });

        const row = screen.getByText('some-test-name');
        userEvent.click(row);

        expect(historyMock.push).toBeCalledWith('/studies/5LMdXPD3ocgD');
    });

    it('should show the add icon when showStudyOptions flag is enabled', async () => {
        useAuth0().isAuthenticated = true;

        await act(async () => {
            render(
                <MockThemeProvider>
                    <SnackbarProvider>
                        <Router history={historyMock as any}>
                            <StudiesTable showStudyOptions={true} studies={mockStudiesNoInfo} />
                        </Router>
                    </SnackbarProvider>
                </MockThemeProvider>
            );
        });

        const icon = screen.getByTestId('add-studyset-button');
        expect(icon).toBeInTheDocument();
    });

    it('should hide the add icon when showStudyOptions flag is false', async () => {
        useAuth0().isAuthenticated = true;

        await act(async () => {
            render(
                <MockThemeProvider>
                    <SnackbarProvider>
                        <Router history={historyMock as any}>
                            <StudiesTable showStudyOptions={false} studies={mockStudiesNoInfo} />
                        </Router>
                    </SnackbarProvider>
                </MockThemeProvider>
            );
        });

        const icon = screen.queryByTestId('add-studyset-button');
        expect(icon).not.toBeInTheDocument();
    });
});
