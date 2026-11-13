import React, { useEffect, useId, useRef, useState } from 'react';
import { useDataProvider, useInput, useNotify } from 'react-admin';
import { Box, Button, CircularProgress, FormHelperText, Stack, Typography } from '@mui/material';
import { Crop, DeleteOutlined, FileUpload, ImageOutlined } from '@mui/icons-material';
import type { ImageCropOptions } from '@tsyvinda/shared-types';
import type { AdminDataProvider } from '../../providers/dataProvider';
import { ImageCropDialog } from './ImageCropDialog';

/** Types and size the API's upload accepts (shared/upload-options.ts). */
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;
const PREVIEW_HEIGHT = 120;

export interface ImageFieldInputProps {
  source: string;
  label: string;
  helperText?: string;
  /** Crop before upload: a picked file opens the crop dialog; stored images get a Crop button */
  crop?: ImageCropOptions;
}

/**
 * A CMS image field: the picked file is uploaded at once and the field keeps its URL, so the
 * page is saved as plain JSON. With `crop`, a picked file is cropped first (and a stored one can
 * be re-cropped); the crop is uploaded as a new file. Remove clears the field; the API deletes
 * files the page no longer shows on save.
 */
export const ImageFieldInput: React.FC<ImageFieldInputProps> = ({
  source,
  label,
  helperText,
  crop,
}) => {
  const { field, fieldState } = useInput({
    source,
    parse: (value: string | null) => value || null,
  });
  const dataProvider = useDataProvider<AdminDataProvider>();
  const notify = useNotify();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const labelId = useId();
  const url = typeof field.value === 'string' && field.value ? field.value : null;
  /** What the crop dialog shows: a picked file's object URL or the stored image; null = closed */
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  // Object URLs of picked files are freed when the dialog moves on
  useEffect(
    () => () => {
      if (cropSource?.startsWith('blob:')) URL.revokeObjectURL(cropSource);
    },
    [cropSource],
  );

  /** Uploads a file (picked, or the crop result); true when the field now holds its URL. */
  const upload = async (file: Blob): Promise<boolean> => {
    if (file.size > MAX_BYTES) {
      notify('The image is larger than 5 MB', { type: 'error' });
      return false;
    }
    setIsUploading(true);
    try {
      const named =
        file instanceof File
          ? file
          : new File([file], `image.${file.type === 'image/webp' ? 'webp' : 'jpg'}`, {
              type: file.type,
            });
      const { url: uploadedUrl } = await dataProvider.uploadPageImage(named);
      field.onChange(uploadedUrl);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Upload failed', { type: 'error' });
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const onFilePicked = (file: File) => {
    if (crop) setCropSource(URL.createObjectURL(file));
    else void upload(file);
  };

  const applyCrop = async (blob: Blob) => {
    if (await upload(blob)) setCropSource(null);
  };

  return (
    <Box
      role="group"
      aria-labelledby={labelId}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, my: 1 }}
    >
      <Typography id={labelId} variant="subtitle2" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Box
          sx={{
            // Thumbnail in the crop's aspect (wide for share images), 120 px tall
            width: Math.round(PREVIEW_HEIGHT * (crop?.aspect ?? 1)),
            height: PREVIEW_HEIGHT,
            flexShrink: 0,
            borderRadius: 1,
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {isUploading ? (
            <CircularProgress size={24} />
          ) : url ? (
            <Box
              component="img"
              src={url}
              // Same CORS mode as the crop dialog, so its request can reuse this cached copy
              crossOrigin="anonymous"
              alt={`${label} preview`}
              onLoad={(event: React.SyntheticEvent<HTMLImageElement>) =>
                setImageSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: crop?.shape === 'circle' ? '50%' : 0,
              }}
            />
          ) : (
            <ImageOutlined sx={{ color: 'text.disabled' }} />
          )}
        </Box>
        <Stack spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileUpload />}
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {url ? 'Replace' : 'Choose image'}
          </Button>
          {url && crop && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Crop />}
              disabled={isUploading}
              onClick={() => setCropSource(url)}
            >
              Crop
            </Button>
          )}
          {url && (
            <Button
              size="small"
              color="error"
              startIcon={<DeleteOutlined />}
              disabled={isUploading}
              onClick={() => field.onChange(null)}
            >
              Remove
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            hidden
            aria-label={`Upload ${label}`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onFilePicked(file);
            }}
          />
          {url && imageSize && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {imageSize.width} × {imageSize.height} px
            </Typography>
          )}
        </Stack>
      </Stack>
      {(fieldState.error?.message || helperText) && (
        <FormHelperText error={Boolean(fieldState.error)} sx={{ mt: 1 }}>
          {fieldState.error?.message ?? helperText}
        </FormHelperText>
      )}
      {crop && (
        <ImageCropDialog
          open={cropSource !== null}
          label={label}
          src={cropSource}
          crop={crop}
          onCancel={() => setCropSource(null)}
          onApply={applyCrop}
        />
      )}
    </Box>
  );
};
