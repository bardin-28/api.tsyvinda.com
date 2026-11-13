import React from 'react';
import { Title } from 'react-admin';
import { Box, Stack, Typography } from '@mui/material';
import { SearchEnginesCard } from './SearchEnginesCard';

/** Settings → General. Full width: cards stretch across the content area. */
export const GeneralSettingsPage: React.FC = () => (
  <Box sx={{ mt: 2, width: '100%' }}>
    <Title title="General settings" />
    <Box sx={{ mb: 3 }}>
      <Typography variant="h2" sx={{ mb: 0.5 }}>
        General settings
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Website-wide settings. Changes apply on the website right away.
      </Typography>
    </Box>
    <Stack spacing={2}>
      <SearchEnginesCard />
    </Stack>
  </Box>
);
