import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Confirm,
  HttpError,
  List,
  Pagination,
  SearchInput,
  TopToolbar,
  useDelete,
  useListContext,
  useNotify,
  useRefresh,
} from 'react-admin';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { ContentCopy, DeleteOutlined, FileUpload, OpenInNew } from '@mui/icons-material';
import type { AdminMedia, MediaUsage } from '@tsyvinda/shared-types';
import { formatDateTime } from '../../lib/dateFormat';
import {
  MEDIA_ACCEPT,
  formatBytes,
  mediaName,
  useMediaUpload,
} from '../../components/media/mediaUpload';

const USAGE_PATH: Record<MediaUsage['kind'], (id: string) => string> = {
  post: (id) => `/posts/${id}`,
  user: (id) => `/users/${id}`,
  page: (id) => `/pages/${id}`,
};

/** Upload button of the list toolbar (several files at once). */
const UploadButton: React.FC = () => {
  const { upload, isUploading } = useMediaUpload();
  const refresh = useRefresh();
  const notify = useNotify();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    const uploaded = await upload([...(files ?? [])]);
    if (uploaded.length > 0) {
      notify(`${uploaded.length} image${uploaded.length === 1 ? '' : 's'} uploaded`, {
        type: 'success',
      });
      refresh();
    }
  };

  return (
    <>
      <Button
        variant="contained"
        startIcon={isUploading ? <CircularProgress size={16} color="inherit" /> : <FileUpload />}
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        Upload
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        multiple
        hidden
        aria-label="Upload images"
        onChange={(event) => {
          void onFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </>
  );
};

/** One library image: preview, facts, where it is used, copy / open / delete. */
const MediaCard: React.FC<{ media: AdminMedia }> = ({ media }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [deleteOne, { isPending }] = useDelete();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const inUse = media.usages.length > 0;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(media.url);
      notify('URL copied', { type: 'info' });
    } catch {
      notify('Could not copy the URL', { type: 'error' });
    }
  };

  const remove = () =>
    deleteOne(
      'media',
      { id: media.id, previousData: media },
      {
        mutationMode: 'pessimistic',
        onSuccess: () => {
          notify('Image deleted', { type: 'info' });
          refresh();
        },
        onError: (error) => notify((error as HttpError).message, { type: 'error' }),
        onSettled: () => setIsConfirmOpen(false),
      },
    );

  return (
    <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column' }}>
      <CardMedia
        component="img"
        image={media.url}
        alt={mediaName(media)}
        loading="lazy"
        sx={{ aspectRatio: '4 / 3', objectFit: 'contain', bgcolor: 'action.hover' }}
      />
      <CardContent sx={{ flex: 1, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {mediaName(media)}
        </Typography>
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
          {formatBytes(media.size)} · {formatDateTime(media.createdAt)}
          {media.uploadedBy ? ` · ${media.uploadedBy.name}` : ''}
        </Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          {inUse ? (
            media.usages.map((usage) => (
              <Chip
                key={`${usage.kind}:${usage.id}`}
                size="small"
                component={Link}
                clickable
                to={USAGE_PATH[usage.kind](usage.id)}
                label={`${usage.kind === 'post' ? 'Post' : usage.kind === 'user' ? 'Avatar' : 'Page'}: ${usage.label}`}
                sx={{ maxWidth: '100%' }}
              />
            ))
          ) : (
            <Chip size="small" variant="outlined" label="Unused" />
          )}
        </Stack>
      </CardContent>
      <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
        <Tooltip title="Copy URL">
          <IconButton size="small" onClick={copyUrl} aria-label={`Copy URL of ${mediaName(media)}`}>
            <ContentCopy fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Open">
          <IconButton
            size="small"
            component="a"
            href={media.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${mediaName(media)}`}
          >
            <OpenInNew fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={inUse ? 'In use: replace it there first' : 'Delete'}>
          <span>
            <IconButton
              size="small"
              color="error"
              disabled={inUse || isPending}
              onClick={() => setIsConfirmOpen(true)}
              aria-label={`Delete ${mediaName(media)}`}
            >
              <DeleteOutlined fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </CardActions>
      <Confirm
        isOpen={isConfirmOpen}
        loading={isPending}
        title={`Delete ${mediaName(media)}?`}
        content="The file is removed from storage. This cannot be undone."
        onConfirm={remove}
        onClose={() => setIsConfirmOpen(false)}
      />
    </Card>
  );
};

const MediaGrid: React.FC = () => {
  const { data, isPending } = useListContext<AdminMedia>();
  if (isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!data?.length) {
    return (
      <Typography sx={{ color: 'text.secondary', p: 6, textAlign: 'center' }}>
        No images yet. Upload one, or add a cover, avatar or page photo.
      </Typography>
    );
  }
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        p: 2,
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      }}
    >
      {data.map((media) => (
        <MediaCard key={media.id} media={media} />
      ))}
    </Box>
  );
};

const filters = [<SearchInput key="q" source="q" alwaysOn placeholder="Search by file name" />];

/**
 * Media library (like WordPress' Media): every image uploaded anywhere in the panel, reusable
 * from any image field. Images in use can't be deleted here; replaced ones that nothing uses
 * any more are removed automatically.
 */
export const MediaList: React.FC = () => (
  <List
    title="Media"
    filters={filters}
    exporter={false}
    sort={{ field: 'createdAt', order: 'DESC' }}
    perPage={40}
    pagination={<Pagination rowsPerPageOptions={[20, 40, 100]} />}
    actions={
      <TopToolbar>
        <UploadButton />
      </TopToolbar>
    }
  >
    <MediaGrid />
  </List>
);
