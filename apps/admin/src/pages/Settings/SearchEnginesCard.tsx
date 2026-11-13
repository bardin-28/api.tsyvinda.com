import React, { useState } from 'react';
import { Confirm, useDataProvider, useNotify } from 'react-admin';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Card,
  CardContent,
  FormControlLabel,
  LinearProgress,
  Switch,
  Typography,
} from '@mui/material';
import type { SiteSettings } from '@tsyvinda/shared-types';
import type { AdminDataProvider } from '../../providers/dataProvider';
import { formatDateTime } from '../../lib/dateFormat';

export const SITE_SETTINGS_QUERY_KEY = ['admin', 'site-settings'];

/**
 * Search engine indexing switch. Both directions ask for confirmation: hiding the site takes
 * days or weeks to drop out of results, and allowing it makes every page listable.
 */
export const SearchEnginesCard: React.FC = () => {
  const dataProvider = useDataProvider<AdminDataProvider>();
  const notify = useNotify();
  const queryClient = useQueryClient();
  // The value the admin is about to switch to, while the confirmation is open
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);

  const { data: settings, error } = useQuery({
    queryKey: SITE_SETTINGS_QUERY_KEY,
    queryFn: () => dataProvider.getSiteSettings(),
  });

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: (indexingEnabled: boolean) => dataProvider.saveSiteSettings({ indexingEnabled }),
    onSuccess: (saved: SiteSettings) => {
      queryClient.setQueryData(SITE_SETTINGS_QUERY_KEY, saved);
      notify(
        saved.indexingEnabled
          ? 'Search engines may now index the website'
          : 'The website is hidden from search engines',
        { type: 'success' },
      );
    },
    onError: (saveError: Error) => notify(saveError.message, { type: 'error' }),
  });

  const enabled = settings?.indexingEnabled ?? false;

  return (
    <Card>
      <CardContent>
        <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
          Search engines
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, maxWidth: 720 }}>
          While indexing is off, every page of the website tells Google and other search engines not
          to list it, and the sitemap is empty. Switched on, the website is indexed as usual.
        </Typography>

        {error && <Alert severity="error">{error.message}</Alert>}
        {!settings && !error && <LinearProgress />}

        {settings && (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={enabled}
                  onChange={(event) => setPendingValue(event.target.checked)}
                  disabled={isSaving}
                />
              }
              label="Allow search engines to index the website"
            />
            {settings.updatedAt && (
              <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
                Last changed {formatDateTime(settings.updatedAt)}
              </Typography>
            )}
            {isSaving && <LinearProgress sx={{ mt: 2 }} />}
          </>
        )}
      </CardContent>

      <Confirm
        isOpen={pendingValue !== null}
        title={
          pendingValue
            ? 'Let search engines index the website?'
            : 'Hide the website from search engines?'
        }
        content={
          pendingValue
            ? "Google and other search engines will start listing the website's pages."
            : 'Every page will ask search engines to drop it from their results. Pages already listed can take days or weeks to disappear.'
        }
        confirm={pendingValue ? 'Allow indexing' : 'Hide website'}
        onConfirm={() => {
          if (pendingValue !== null) save(pendingValue);
          setPendingValue(null);
        }}
        onClose={() => setPendingValue(null)}
      />
    </Card>
  );
};
