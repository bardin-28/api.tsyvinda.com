import React from 'react';
import { Box } from '@mui/material';

/** "TS" tile used in the app bar and on the sign-in card. */
export const BrandMark: React.FC<{ size: number; fontSize: number }> = ({ size, fontSize }) => (
  <Box
    aria-hidden
    sx={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: size > 30 ? 1.5 : 1,
      bgcolor: 'primary.main',
      color: 'primary.contrastText',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize,
      fontWeight: 700,
      letterSpacing: '-0.03em',
    }}
  >
    TS
  </Box>
);
