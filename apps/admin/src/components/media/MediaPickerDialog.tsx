import React, { useEffect, useRef, useState } from 'react';
import { useDataProvider, useNotify } from 'react-admin';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CheckCircle, FileUpload, Search } from '@mui/icons-material';
import type { AdminMedia } from '@tsyvinda/shared-types';
import { MEDIA_ACCEPT, mediaName, useMediaUpload } from './mediaUpload';

const PER_PAGE = 30;

export interface MediaPickerDialogProps {
  open: boolean;
  /** "Choose image — <label>" */
  label: string;
  onClose: () => void;
  onSelect: (media: AdminMedia) => void;
}

/**
 * WordPress-style "Media library" picker: search, upload new images, pick one. Picking hands
 * back the library image; the field stores its URL.
 */
export const MediaPickerDialog: React.FC<MediaPickerDialogProps> = ({
  open,
  label,
  onClose,
  onSelect,
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const { upload, isUploading } = useMediaUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<AdminMedia[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<AdminMedia | null>(null);

  // (Re)load from page 1 when opened or when the search changes (debounced)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data, total: count } = await dataProvider.getList<AdminMedia>('media', {
          pagination: { page: 1, perPage: PER_PAGE },
          sort: { field: 'createdAt', order: 'DESC' },
          filter: query ? { q: query } : {},
        });
        if (cancelled) return;
        setItems(data);
        setTotal(count ?? data.length);
        setPage(1);
      } catch (error) {
        if (!cancelled) notify((error as Error).message, { type: 'error' });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, dataProvider, notify]);

  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  const loadMore = async () => {
    setIsLoading(true);
    try {
      const next = page + 1;
      const { data } = await dataProvider.getList<AdminMedia>('media', {
        pagination: { page: next, perPage: PER_PAGE },
        sort: { field: 'createdAt', order: 'DESC' },
        filter: query ? { q: query } : {},
      });
      setItems((current) => [...current, ...data]);
      setPage(next);
    } finally {
      setIsLoading(false);
    }
  };

  const onFiles = async (files: FileList | null) => {
    const uploaded = await upload([...(files ?? [])]);
    if (uploaded.length === 0) return;
    setItems((current) => [...uploaded, ...current]);
    setTotal((count) => count + uploaded.length);
    setSelected(uploaded[0]!);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Media library — {label}</DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search by file name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              },
              htmlInput: { 'aria-label': 'Search the media library' },
            }}
            sx={{ flex: 1 }}
          />
          <Button
            variant="outlined"
            startIcon={isUploading ? <CircularProgress size={16} /> : <FileUpload />}
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={MEDIA_ACCEPT}
            multiple
            hidden
            aria-label="Upload to the media library"
            onChange={(event) => {
              void onFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </Stack>
        {items.length === 0 && !isLoading ? (
          <Typography sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
            {query ? 'No images match this search.' : 'The library is empty. Upload an image.'}
          </Typography>
        ) : (
          <ImageList cols={5} gap={8} sx={{ m: 0 }} role="listbox" aria-label="Images">
            {items.map((media) => {
              const isSelected = selected?.id === media.id;
              return (
                <ImageListItem
                  key={media.id}
                  role="option"
                  aria-selected={isSelected}
                  aria-label={mediaName(media)}
                  tabIndex={0}
                  onClick={() => setSelected(media)}
                  onDoubleClick={() => onSelect(media)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onSelect(media);
                    if (event.key === ' ') {
                      event.preventDefault();
                      setSelected(media);
                    }
                  }}
                  sx={{
                    cursor: 'pointer',
                    borderRadius: 1,
                    overflow: 'hidden',
                    outline: isSelected ? 3 : 0,
                    outlineColor: 'primary.main',
                    outlineStyle: 'solid',
                    aspectRatio: '1',
                    bgcolor: 'action.hover',
                    '& .MuiImageListItem-img': { height: '100%', objectFit: 'contain' },
                  }}
                >
                  <img src={media.url} alt="" loading="lazy" />
                  <ImageListItemBar
                    title={mediaName(media)}
                    subtitle={media.usages.length ? `Used ${media.usages.length}×` : 'Unused'}
                    actionIcon={isSelected ? <CheckCircle sx={{ color: 'white', mr: 1 }} /> : null}
                    sx={{ '& .MuiImageListItemBar-title': { fontSize: 12 } }}
                  />
                </ImageListItem>
              );
            })}
          </ImageList>
        )}
        {(isLoading || items.length < total) && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            {isLoading ? (
              <CircularProgress size={24} />
            ) : (
              <Button onClick={loadMore}>Load more</Button>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
        >
          Use this image
        </Button>
      </DialogActions>
    </Dialog>
  );
};
