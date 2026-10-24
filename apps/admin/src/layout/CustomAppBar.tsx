import React from 'react';
import {
  AppBar,
  Logout,
  TitlePortal,
  ToggleThemeButton,
  UserMenu,
  useLoading,
  useThemesContext,
} from 'react-admin';
import { Box, CircularProgress, Typography } from '@mui/material';
import { BrandMark } from './BrandMark';

/**
 * Global "request in flight" hint. RA bundles this with a manual refresh button
 * inside <LoadingIndicator>, so keeping the feedback means rendering it here.
 */
const LoadingHint: React.FC = () => {
  const loading = useLoading();

  return (
    <Box
      aria-hidden={!loading}
      sx={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {loading && <CircularProgress color="inherit" size={16} thickness={5} />}
    </Box>
  );
};

// Replaces RA's default toolbar (locales menu + theme toggle + refresh button).
const AppBarToolbar: React.FC = () => {
  const { darkTheme } = useThemesContext();

  return (
    <>
      {darkTheme && <ToggleThemeButton />}
      <LoadingHint />
    </>
  );
};

export const CustomAppBar: React.FC = () => (
  <AppBar
    color="inherit"
    toolbar={<AppBarToolbar />}
    userMenu={
      <UserMenu>
        <Logout />
      </UserMenu>
    }
  >
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, mr: 2 }}>
      <BrandMark size={22} fontSize={11} />
      <Typography variant="subtitle1" noWrap sx={{ letterSpacing: '-0.01em' }}>
        tsyvinda.com Admin
      </Typography>
      {/* Page title RA publishes from the current view, right of the brand */}
      <TitlePortal
        variant="body2"
        sx={{ color: 'text.secondary', ml: 1, display: { xs: 'none', sm: 'block' } }}
      />
    </Box>
  </AppBar>
);
