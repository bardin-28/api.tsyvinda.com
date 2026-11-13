import React, { useRef } from 'react';
import { ImageInput, type ImageInputProps } from 'react-admin';
import { useFormContext, useWatch } from 'react-hook-form';
import { Box, Button, Stack } from '@mui/material';
import { DeleteOutlined, FileUpload } from '@mui/icons-material';

type SingleImageInputProps = Omit<ImageInputProps, 'multiple'> & { source: string };

/** A stored URL, or a picked file (RA keeps `{ rawFile, src }`), counts as "has an image". */
function hasImageValue(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0;
  return typeof value === 'object' && value !== null;
}

/**
 * One image (cover, OG image, avatar). Empty: RA's drop area. With an image: only the preview
 * plus Replace / Remove — no drop area taking space. Replace opens the same (hidden) file
 * input, so validation (types, size) is unchanged.
 */
export const SingleImageInput: React.FC<SingleImageInputProps> = ({ source, sx, ...props }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const value = useWatch({ name: source }) as unknown;
  const { setValue } = useFormContext();
  const hasImage = hasImageValue(value);

  const openFilePicker = () =>
    containerRef.current?.querySelector<HTMLInputElement>('input[type="file"]')?.click();

  const removeImage = () => setValue(source, null, { shouldDirty: true });

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 2,
        // With an image the drop area and RA's own hover "×" are replaced by the buttons
        ...(hasImage && {
          '& .RaFileInput-dropZone': { display: 'none' },
          '& .RaFileInputPreview-removeButton': { display: 'none' },
          '& .MuiFormHelperText-root': { display: 'none' },
        }),
      }}
    >
      <ImageInput
        source={source}
        label={false}
        multiple={false}
        sx={[
          // With an image, shrink to the preview so the buttons sit beside it
          { m: 0, flex: hasImage ? '0 0 auto' : '1 1 100%', width: hasImage ? 'auto' : '100%' },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...props}
      />
      {hasImage && (
        <Stack spacing={1} sx={{ pt: 0.5 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileUpload />}
            onClick={openFilePicker}
          >
            Replace
          </Button>
          <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={removeImage}>
            Remove
          </Button>
        </Stack>
      )}
    </Box>
  );
};
