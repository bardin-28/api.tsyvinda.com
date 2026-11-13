import React, { useEffect, useRef, useState } from 'react';
import { ImageInput, type ImageInputProps } from 'react-admin';
import { useFormContext, useWatch } from 'react-hook-form';
import { Box, Button, Stack } from '@mui/material';
import { Crop, DeleteOutlined, FileUpload, PermMedia } from '@mui/icons-material';
import type { ImageCropOptions } from '@tsyvinda/shared-types';
import { ImageCropDialog } from './cms/ImageCropDialog';
import { MediaPickerDialog } from './media/MediaPickerDialog';

type SingleImageInputProps = Omit<ImageInputProps, 'multiple'> & {
  source: string;
  /** Crop before saving: a picked file opens the crop dialog; the image gets a Crop button */
  crop?: ImageCropOptions;
  /** Name in the crop / media dialogs' titles ("Crop image — Avatar") */
  cropLabel?: string;
  /** Offer "Media library" to reuse an uploaded image (the field then holds its URL) */
  library?: boolean;
};

/**
 * A picked file as RA's ImageInput keeps it (`{ rawFile, src, title }`). After a crop it also
 * remembers the uncropped original, so cropping again starts from the full image.
 */
interface PickedImage {
  rawFile: File;
  src?: string;
  title?: string;
  /** Set once the file went through the crop dialog */
  cropped?: boolean;
  /** Object URL of the uncropped pick */
  originalSrc?: string;
}

const isPicked = (value: unknown): value is PickedImage =>
  typeof value === 'object' && value !== null && (value as PickedImage).rawFile instanceof File;

/** A stored URL, or a picked file (RA keeps `{ rawFile, src }`), counts as "has an image". */
function hasImageValue(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0;
  return typeof value === 'object' && value !== null;
}

/** What the crop dialog should show for the current value: the original pick or the stored URL. */
function cropSourceOf(value: unknown): string | null {
  if (typeof value === 'string') return value || null;
  if (isPicked(value)) return value.originalSrc ?? value.src ?? null;
  return null;
}

/** File name of a crop result: the picked name with the exported type's extension. */
function croppedFileName(blob: Blob, pickedName?: string): string {
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const base = pickedName?.replace(/\.[^.]+$/, '') || 'image';
  return `${base}.${extension}`;
}

/**
 * One image (cover, OG image, avatar). Empty: RA's drop area. With an image: only the preview
 * plus Replace / Remove — no drop area taking space. Replace opens the same (hidden) file
 * input, so validation (types, size) is unchanged.
 *
 * With `crop`, every picked file goes through the crop dialog before it lands in the form
 * (Cancel restores the previous value), and a Crop button re-crops the current image. The
 * cropped file is uploaded on save like any picked file.
 */
export const SingleImageInput: React.FC<SingleImageInputProps> = ({
  source,
  sx,
  crop,
  cropLabel = 'Image',
  library = true,
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const value = useWatch({ name: source }) as unknown;
  const { getValues, setValue } = useFormContext();
  const hasImage = hasImageValue(value);
  /** The value before the pick that opened the dialog (restored on Cancel) */
  const beforePick = useRef<unknown>(getValues(source));
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // A fresh pick (not cropped yet) opens the crop dialog
  useEffect(() => {
    if (!crop) return;
    if (isPicked(value) && !value.cropped) {
      setCropSource(value.src ?? null);
    } else if (!isPicked(value) || value.cropped) {
      beforePick.current = value;
    }
  }, [crop, value]);

  const openFilePicker = () =>
    containerRef.current?.querySelector<HTMLInputElement>('input[type="file"]')?.click();

  const removeImage = () => setValue(source, null, { shouldDirty: true });

  const cancelCrop = () => {
    // A pick that was never cropped is dropped; re-cropping an image leaves it as it was
    if (isPicked(value) && !value.cropped) {
      setValue(source, beforePick.current ?? null, { shouldDirty: true });
    }
    setCropSource(null);
  };

  const applyCrop = (blob: Blob) => {
    const picked = isPicked(value) ? value : null;
    const file = new File([blob], croppedFileName(blob, picked?.rawFile.name), {
      type: blob.type,
    });
    const next: PickedImage = {
      rawFile: file,
      src: URL.createObjectURL(blob),
      title: file.name,
      cropped: true,
      originalSrc: cropSource ?? undefined,
    };
    setValue(source, next, { shouldDirty: true });
    setCropSource(null);
  };

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
      {!hasImage && library && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<PermMedia />}
          onClick={() => setIsLibraryOpen(true)}
        >
          Media library
        </Button>
      )}
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
          {library && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<PermMedia />}
              onClick={() => setIsLibraryOpen(true)}
            >
              Media library
            </Button>
          )}
          {crop && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Crop />}
              onClick={() => setCropSource(cropSourceOf(value))}
            >
              Crop
            </Button>
          )}
          <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={removeImage}>
            Remove
          </Button>
        </Stack>
      )}
      {library && (
        <MediaPickerDialog
          open={isLibraryOpen}
          label={cropLabel}
          onClose={() => setIsLibraryOpen(false)}
          onSelect={(media) => {
            // A library image is stored by URL; it is already in the library, so no crop step
            setValue(source, media.url, { shouldDirty: true });
            setIsLibraryOpen(false);
          }}
        />
      )}
      {crop && (
        <ImageCropDialog
          open={cropSource !== null}
          label={cropLabel}
          src={cropSource}
          crop={crop}
          onCancel={cancelCrop}
          onApply={applyCrop}
        />
      )}
    </Box>
  );
};
