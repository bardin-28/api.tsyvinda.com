import React from 'react';
import {
  CreateButton,
  useGetResourceLabel,
  useListContext,
  useResourceContext,
  useResourceDefinition,
} from 'react-admin';
import { Box, Button, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import { FilterAltOff, Inbox, SearchOff } from '@mui/icons-material';

interface EmptyStateProps {
  icon: SvgIconComponent;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  /** Smaller variant for placeholders inside cards (e.g. dashboard widgets) */
  compact?: boolean;
}

/**
 * Placeholder for "nothing to show": icon, title and a short subtitle, centered horizontally and
 * vertically in whatever space its (flex) parent gives it.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  subtitle,
  action,
  compact = false,
}) => (
  <Box
    role="status"
    sx={{
      flex: 1,
      alignSelf: 'stretch',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: 1,
      p: compact ? 3 : 4,
      minHeight: compact ? 160 : 240,
    }}
  >
    <Icon
      aria-hidden
      sx={{ fontSize: compact ? 36 : 56, color: 'text.secondary', opacity: 0.5, mb: 0.5 }}
    />
    <Typography variant={compact ? 'subtitle1' : 'h4'} component="p">
      {title}
    </Typography>
    <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 360 }}>
      {subtitle}
    </Typography>
    {action && <Box sx={{ mt: 1.5 }}>{action}</Box>}
  </Box>
);

/**
 * What the list holds, lower-cased plural ("articles", "users"). Defaults to the resource's
 * menu label; pass `noun` when that label isn't a plain noun (e.g. "All users").
 */
function useResourceNoun(noun?: string): string {
  const resource = useResourceContext() ?? '';
  const getResourceLabel = useGetResourceLabel();
  return noun ?? getResourceLabel(resource, 2).toLowerCase();
}

/**
 * `<List empty>`: the resource has no records at all (no filters applied).
 * Offers the create button when the resource has a create view.
 */
export const ListEmpty: React.FC<{
  subtitle: string;
  icon?: SvgIconComponent;
  noun?: string;
}> = ({ subtitle, icon = Inbox, noun: nounOverride }) => {
  const noun = useResourceNoun(nounOverride);
  const { hasCreate } = useResourceDefinition();
  return (
    <EmptyState
      icon={icon}
      title={`No ${noun} yet`}
      subtitle={subtitle}
      action={hasCreate ? <CreateButton variant="contained" /> : undefined}
    />
  );
};

/** `<Datagrid empty>`: records exist but the current search/filters match none. */
export const ListNoResults: React.FC<{ noun?: string }> = ({ noun: nounOverride }) => {
  const noun = useResourceNoun(nounOverride);
  const { filterValues, setFilters } = useListContext();
  const hasFilters = Object.keys(filterValues ?? {}).length > 0;
  return (
    <EmptyState
      icon={hasFilters ? SearchOff : Inbox}
      title={`No ${noun} found`}
      subtitle={
        hasFilters
          ? 'Nothing matches the current search or filters.'
          : 'There is nothing on this page.'
      }
      action={
        hasFilters ? (
          <Button
            variant="outlined"
            startIcon={<FilterAltOff />}
            onClick={() => setFilters({}, [])}
          >
            Clear filters
          </Button>
        ) : undefined
      }
    />
  );
};
