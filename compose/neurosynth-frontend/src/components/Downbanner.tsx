import { Cancel } from "@mui/icons-material";
import EmojiPeopleIcon from "@mui/icons-material/EmojiPeople";
import { Box, IconButton, Link } from "@mui/material";
import BaseNavigationStyles from "pages/BaseNavigation/BaseNavigation.styles";
import { useState } from "react";

const localStorageDownBannerKey = "hide-downbanner-nov-6-2024";

const Downbanner: React.FC = () => {
  const shouldHide = !!localStorage.getItem(localStorageDownBannerKey);
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
          Join us next Wednesday, November 13th at 19:00 ET for the inaugural
          Neurosynth Compose Virtual Town Hall!{" "}
          <Link
            color="primary.contrastText"
            sx={{ marginLeft: "4px" }}
            href="https://smmo1.mjt.lu/lnk/AUUAAFUYj_MAAAAYAkQAAMQWKMIAAAABy9QAAd5pACejZgBnKVfVT2hXpDCyQC6H3aykCv_XyAAbJus/1/mr5Wo-0t0LWaATWN2bFHLA/aHR0cHM6Ly90YWxseS5zby9yLzN5cWIwNA"
            target="_blank"
          >
            Click here to register
          </Link>
        </Box>
        <IconButton
          onClick={() => {
            localStorage.setItem(localStorageDownBannerKey, "true");
            setHideBanner(true);
          }}
          sx={{
            padding: 0,
            ":hover": { backgroundColor: "secondary.light" },
          }}
        >
          <Cancel />
        </IconButton>
      </Box>
    </Box>
  );
};

export default Downbanner;
