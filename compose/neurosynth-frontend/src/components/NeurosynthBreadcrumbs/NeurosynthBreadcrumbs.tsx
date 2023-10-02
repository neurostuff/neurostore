import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import React from 'react';
import { NavLink } from 'react-router-dom';

interface INeurosynthBreadcrumbs {
    link: string;
    text: string;
    isCurrentPage: boolean;
}

const NeurosynthBreadcrumbs: React.FC<{ breadcrumbItems: INeurosynthBreadcrumbs[] }> = React.memo(
    (props) => {
        return (
            <Box sx={{ display: 'flex' }}>
                <Breadcrumbs>
                    {props.breadcrumbItems.map((breadcrumb, index) =>
                        breadcrumb.isCurrentPage ? (
                            <Typography
                                key={index}
                                color="secondary"
                                variant="h6"
                                sx={{
                                    maxWidth: '300px',
                                    textOverflow: 'ellipsis',
                                    display: 'block',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {breadcrumb.text}
                            </Typography>
                        ) : (
                            <Link
                                key={index}
                                component={NavLink}
                                to={breadcrumb.link}
                                sx={{
                                    fontSize: '1.25rem',
                                    cursor: 'pointer',
                                    maxWidth: '300px',
                                    textOverflow: 'ellipsis',
                                    display: 'block',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                }}
                                underline="hover"
                            >
                                {breadcrumb.text}
                            </Link>
                        )
                    )}
                </Breadcrumbs>
            </Box>
        );
    }
);

export default NeurosynthBreadcrumbs;
