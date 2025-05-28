import { KeyboardArrowDown } from '@mui/icons-material';
import NavToolbarPopupSubMenu from 'components/Navbar/NavToolbarPopupSubMenu';
import ProjectComponentsStyles from 'pages/Project/components/Project.styles';
import { ECurationBoardTypes } from './ProjectCurationStep';
import { Box, Button } from '@mui/material';

const ProjectCurationStepChooseWorkflow: React.FC<{
    onCreateCuration: (colNames: string[], isPRISMA: boolean) => void;
    disabled: boolean;
}> = ({ onCreateCuration, disabled }) => {
    const handleCreateCreationBoard = (curationBoardType: ECurationBoardTypes) => {
        switch (curationBoardType) {
            case ECurationBoardTypes.PRISMA:
                onCreateCuration(['Identification', 'Screening', 'Eligibility', 'Included'], true);
                break;
            case ECurationBoardTypes.SIMPLE:
                onCreateCuration(['Unreviewed', 'Included'], false);
                break;
            // case ECurationBoardTypes.CUSTOM:
            //     setDialogIsOpen(true);
            //     break;
            // case ECurationBoardTypes.SKIP:
            //     // TODO: implement this
            //     break;
            default:
                return;
        }
    };

    if (disabled) {
        return (
            <Box
                sx={[
                    ProjectComponentsStyles.stepCard,
                    ProjectComponentsStyles.getStartedContainer,
                    { borderColor: 'muted.main' },
                ]}
            >
                <Button disabled={disabled} sx={{ width: '100%', height: '100%' }}>
                    curation: get started
                </Button>
            </Box>
        );
    }

    return (
        <Box
            sx={[
                ProjectComponentsStyles.stepCard,
                ProjectComponentsStyles.getStartedContainer,
                { borderColor: 'primary.main' },
            ]}
        >
            <NavToolbarPopupSubMenu
                options={[
                    {
                        label: 'PRISMA Workflow',
                        secondary:
                            'Standard PRISMA workflow and modal use case. Curation step includes four columns: Identification, Screening, Eligibility, and Included',
                        onClick: () => handleCreateCreationBoard(ECurationBoardTypes.PRISMA),
                    },
                    {
                        label: 'Simple Workflow',
                        secondary:
                            'Streamlined workflow for users that want to generate a quickly curated meta-analysis',
                        onClick: () => handleCreateCreationBoard(ECurationBoardTypes.SIMPLE),
                    },
                    // {
                    //     label: 'Custom',
                    //     secondary:
                    //         'Specify how many columns you want for a custom inclusion/exclusion workflow',
                    //     onClick: () => handleCreateCreationBoard(ECurationBoardTypes.CUSTOM),
                    // },
                ]}
                buttonProps={{
                    endIcon: <KeyboardArrowDown />,
                    sx: { width: '100%', height: '100%' },
                }}
                buttonLabel="curation: get started"
            />
        </Box>
    );
};

export default ProjectCurationStepChooseWorkflow;
