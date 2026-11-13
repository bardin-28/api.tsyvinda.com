import React from 'react';
import { SaveButton } from 'react-admin';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';

/** App bar (48px, fixed) + the content padding: where the sticky sidebar stops. */
const STICKY_TOP = 48 + 24;
const SIDEBAR_WIDTH = 300;

/**
 * Detail page: the record's fields on the left, a sticky column of small cards on the right
 * (Save, info, Delete…), which stacks below the fields on narrow screens.
 *
 * Render it inside `<Edit component="div">` / `<Create component="div">`: RA's default Card
 * wrapper has `overflow: hidden`, which would stop the sidebar from sticking.
 */
export const DetailLayout: React.FC<{ children: React.ReactNode; sidebar: React.ReactNode }> = ({
  children,
  sidebar,
}) => (
  <Box
    sx={{
      display: 'grid',
      gap: 2,
      gridTemplateColumns: { xs: '1fr', md: `minmax(0, 1fr) ${SIDEBAR_WIDTH}px` },
      alignItems: 'start',
      width: '100%',
    }}
  >
    <Card sx={{ minWidth: 0 }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {children}
      </CardContent>
    </Card>
    <Stack
      component="aside"
      spacing={2}
      sx={{ position: { md: 'sticky' }, top: STICKY_TOP, minWidth: 0 }}
    >
      {sidebar}
    </Stack>
  </Box>
);

interface SidebarCardProps {
  title: string;
  children: React.ReactNode;
  /** Center the body (e.g. a lone Delete button) */
  centered?: boolean;
}

/** One titled box of the detail sidebar: a header strip, then its content. */
export const SidebarCard: React.FC<SidebarCardProps> = ({ title, children, centered = false }) => (
  <Card component="section" aria-label={title}>
    <Typography
      variant="subtitle2"
      component="h2"
      sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}
    >
      {title}
    </Typography>
    <Box
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        alignItems: centered ? 'center' : 'stretch',
      }}
    >
      {children}
    </Box>
  </Card>
);

/** Label/value rows inside a SidebarCard. */
export const SidebarFacts: React.FC<{ facts: [label: string, value: React.ReactNode][] }> = ({
  facts,
}) => (
  <Box
    component="dl"
    sx={{
      display: 'grid',
      gridTemplateColumns: 'max-content minmax(0, 1fr)',
      columnGap: 2,
      rowGap: 1,
      m: 0,
      alignItems: 'center',
    }}
  >
    {facts.map(([label, value]) => (
      <React.Fragment key={label}>
        <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
      </React.Fragment>
    ))}
  </Box>
);

export const detailDateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const savedAtFormat = (date: Date) =>
  `${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · ${date.toLocaleDateString('en-GB').replaceAll('/', '.')}`;

interface SaveCardProps {
  /** What saving does, e.g. "Changes are live on the website as soon as they are saved." */
  note: string;
  /** Record's last update; shown as "Last saved hh:mm · dd.mm.yyyy" */
  lastSaved?: string | Date;
  label?: string;
  children?: React.ReactNode;
}

/** The sidebar's first card: the full-width Save button (disabled until something changes). */
export const SaveCard: React.FC<SaveCardProps> = ({
  note,
  lastSaved,
  label = 'Save changes',
  children,
}) => (
  <SidebarCard title="Save">
    <SaveButton fullWidth label={label} />
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
      {note}
      {lastSaved && ` Last saved ${savedAtFormat(new Date(lastSaved))}.`}
    </Typography>
    {children}
  </SidebarCard>
);
