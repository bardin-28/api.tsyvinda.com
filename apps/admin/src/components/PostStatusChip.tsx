import React from 'react';
import { Chip } from '@mui/material';
import type { PostStatus } from '@tsyvinda/shared-types';

/** Published = green, Draft = neutral outline. */
export const PostStatusChip: React.FC<{ status: PostStatus }> = ({ status }) =>
  status === 'published' ? (
    <Chip size="small" color="success" label="Published" />
  ) : (
    <Chip size="small" variant="outlined" label="Draft" />
  );
