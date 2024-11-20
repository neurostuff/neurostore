import { Cancel } from "@mui/icons-material";
import EmojiPeopleIcon from "@mui/icons-material/EmojiPeople";
import { Box, IconButton, Link } from "@mui/material";
import BaseNavigationStyles from "pages/BaseNavigation/BaseNavigation.styles";
import { useState } from "react";

const localStorageBannerKey = "hide-banner-nov-20-2024";

const Banner: React.FC = () => {
  const shouldHide = !!localStorage.getItem(localStorageBannerKey);
  const [hideBanner, setHideBanner] = useState(shouldHide);

  if (hideBanner) return <></>;

  return (
    <Box
      sx={{
        backgroundColor: "primary.dark",
        color: "primary.contrastText",
        width: "100%",
        paddingY: "0.5rem",
      }}
    >
      <Box
        sx={[
          BaseNavigationStyles.pagesContainer,
          {
            marginY: "0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          },
        ]}
      >
        <Box display="flex" alignItems="center">
          <EmojiPeopleIcon sx={{ mr: "1rem" }} />
          Join us next Wednesday, December 4th 2024 at 10:00 ET for the
          Neurosynth Compose Virtual Town Hall!{" "}
          <Link
            color="primary.contrastText"
            sx={{ marginLeft: "4px" }}
            href="https://tally.so/r/nWePVR"
            target="_blank"
          >
            Click here to register
          </Link>
        </Box>
        <IconButton
          onClick={() => {
            localStorage.setItem(localStorageBannerKey, "true");
            setHideBanner(true);
          }}
          sx={{
            padding: 0,
            ":hover": { backgroundColor: "gray" },
          }}
        >
          <Cancel />
        </IconButton>
      </Box>
    </Box>
  );
};

export default Banner;
