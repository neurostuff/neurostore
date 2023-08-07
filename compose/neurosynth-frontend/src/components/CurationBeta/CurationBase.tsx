import { Badge, Box, Divider, Tab, Tabs, Typography } from '@mui/material';
import CurationBaseStyles from './CurationBase.styles';
import { useState } from 'react';
import CurateInterface from './CurateInterface';
import { useProjectCurationColumns } from 'stores/ProjectStore';

const CurationBase: React.FC = (props) => {
    const [tabIndex, setTabIndex] = useState(0);
    const columns = useProjectCurationColumns();

    return (
        <Box>
            <Tabs onChange={(event, value) => setTabIndex(value)} value={tabIndex}>
                {columns.map((column, index) => {
                    const hasUncategorizedStubs = column.stubStudies.some((x) => !x.exclusionTag);
                    return (
                        <Tab
                            key={column.id}
                            sx={CurationBaseStyles.tabStyles}
                            label={
                                <Badge
                                    color="warning"
                                    badgeContent={hasUncategorizedStubs ? '' : 0}
                                    variant="dot"
                                >
                                    <Typography sx={{ fontWeight: 'bold' }}>
                                        {column.name} ({column.stubStudies.length})
                                    </Typography>
                                </Badge>
                            }
                            value={index}
                        />
                    );
                })}
            </Tabs>

            <Divider sx={{ marginBottom: '1rem' }} />

            <CurateInterface curationStep={columns[tabIndex]} />
        </Box>
    );
};

export default CurationBase;
