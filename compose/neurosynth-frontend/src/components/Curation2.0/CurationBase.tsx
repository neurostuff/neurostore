import { Badge, Box, Divider, Tab, Tabs, Typography } from '@mui/material';
import CurationBaseStyles from './CurationBase.styles';
import { useState } from 'react';
import CurationStepOverview from './CurationStepOverview';

const CurationBase: React.FC = (props) => {
    const [tabIndex, setTabIndex] = useState(0);

    return (
        <Box>
            <Tabs value={tabIndex}>
                <Tab
                    sx={CurationBaseStyles.tabStyles}
                    label={
                        <Badge color="warning" badgeContent=" " variant="dot">
                            <Typography sx={{ fontWeight: 'bold' }}>Identification (52)</Typography>
                        </Badge>
                    }
                    value={0}
                />
                <Tab sx={CurationBaseStyles.tabStyles} label="Screening (0)" value={1} />
                <Tab sx={CurationBaseStyles.tabStyles} label="Eligibility (0)" value={2} />
                <Tab sx={CurationBaseStyles.tabStyles} label="Included (0)" value={3} />
            </Tabs>

            <Divider />

            <Box>
                {tabIndex === 0 && (
                    <Box>
                        <CurationStepOverview />
                    </Box>
                )}
                {tabIndex === 1 && <Box>this is screening</Box>}
                {tabIndex === 2 && <Box>this is eligibility</Box>}
                {tabIndex === 3 && <Box>this is included</Box>}
            </Box>
        </Box>
    );
};

export default CurationBase;
