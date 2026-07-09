import { Cancel } from '@mui/icons-material';
import EmojiPeopleIcon from '@mui/icons-material/EmojiPeople';
import { Box, IconButton, Link, Typography } from '@mui/material';
import axios, { AxiosError, AxiosResponse } from 'axios';
import BaseNavigationStyles from 'pages/BaseNavigation/BaseNavigation.styles';
import { useMemo, useState } from 'react';
import { useQuery } from 'react-query';

// banner.config.json should adhere to this interface
interface IBanner {
    id: string;
    active: boolean;
    description: string;
    displayStartDate: string;
    displayEndDate: string;
    linkText: string;
    linkURI: string;
    bannerColor: string;
}

const getLocalStorageBannerKey = (bannerId: string) => `CLOSE_BANNER_${bannerId}`;

const isWithinDateRange = (startDate: string, endDate: string): boolean => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    return today >= start && today <= end;
};

const isBannerDismissed = (bannerId: string): boolean => {
    const bannerKey = getLocalStorageBannerKey(bannerId);
    return !!localStorage.getItem(bannerKey);
};

const useGetBannerConfig = () => {
    return useQuery<AxiosResponse<IBanner[]>, AxiosError, IBanner[], string>(
        'bannerConfig',
        () => axios.get<IBanner[]>('/config/banner.config.json'),
        {
            select: (res) => res?.data ?? [],
        }
    );
};

const Banner: React.FC = () => {
    const { data } = useGetBannerConfig();

    const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(() => {
        const dismissed = new Set<string>();
        (data ?? []).forEach((banner) => {
            if (isBannerDismissed(banner.id)) {
                dismissed.add(banner.id);
            }
        });
        return dismissed;
    });

    const visibleBanners = useMemo(() => {
        return (data ?? []).filter(
            (banner) =>
                banner.active &&
                isWithinDateRange(banner.displayStartDate, banner.displayEndDate) &&
                !dismissedBanners.has(banner.id)
        );
    }, [data, dismissedBanners]);

    const handleDismissBanner = (bannerId: string) => {
        const bannerKey = getLocalStorageBannerKey(bannerId);
        localStorage.setItem(bannerKey, 'true');
        setDismissedBanners((prev) => new Set(prev).add(bannerId));
    };

    if (visibleBanners.length === 0) return <></>;

    return (
        <Box>
            {visibleBanners.map((banner: IBanner) => (
                <Box
                    key={banner.id}
                    sx={{
                        backgroundColor: banner.bannerColor,
                        color: 'primary.contrastText',
                        width: '100%',
                        paddingY: '0.5rem',
                    }}
                >
                    <Box
                        sx={[
                            BaseNavigationStyles.pagesContainer,
                            {
                                marginY: '0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            },
                        ]}
                    >
                        <Box display="flex" alignItems="center" width="100%">
                            <Typography
                                variant="body1"
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                            >
                                <EmojiPeopleIcon sx={{ marginRight: '0.5rem' }} />
                                {banner.description}
                            </Typography>
                            <Link
                                color="primary.contrastText"
                                sx={{ marginLeft: '4px' }}
                                href={banner.linkURI}
                                target="_blank"
                            >
                                {banner.linkText}
                            </Link>
                        </Box>
                        <IconButton
                            onClick={() => handleDismissBanner(banner.id)}
                            sx={{
                                padding: 0,
                                ':hover': { backgroundColor: 'gray' },
                            }}
                        >
                            <Cancel />
                        </IconButton>
                    </Box>
                </Box>
            ))}
        </Box>
    );
};

export default Banner;
