import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { Flip, RestartAlt, RotateLeft, RotateRight, ZoomIn, ZoomOut } from '@mui/icons-material';
import type { ImageCropOptions } from '@tsyvinda/shared-types';
import {
  INITIAL_TRANSFORM,
  MAX_ZOOM,
  STRAIGHTEN_LIMIT,
  drawCrop,
  isUntouched,
  normalizeTransform,
  outputSize,
  type CropTransform,
  type Point,
  type Size,
} from '../../lib/imageCrop';

/** Tallest the crop frame gets on screen; wide frames shrink to the dialog's width. */
const MAX_FRAME_HEIGHT = 400;
const ZOOM_STEP = 0.1;
const KEY_MOVE = 10;
const KEY_MOVE_FAST = 50;
const OUTPUT_QUALITY = 0.9;

export interface ImageCropDialogProps {
  open: boolean;
  /** "Crop image — <field label>" */
  label: string;
  /** Object URL of a picked file, or the stored image's URL (needs CORS on the image host) */
  src: string | null;
  crop: ImageCropOptions;
  onCancel: () => void;
  /** The cropped file, ready to upload */
  onApply: (file: Blob) => void | Promise<void>;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; image: HTMLImageElement; size: Size };

function useLoadedImage(src: string | null): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  useEffect(() => {
    if (!src) return;
    setState({ status: 'loading' });
    const image = new Image();
    // Stored images come from the CDN: without CORS the canvas could not be exported
    if (!src.startsWith('blob:') && !src.startsWith('data:')) image.crossOrigin = 'anonymous';
    let cancelled = false;
    image.onload = () => {
      if (!cancelled)
        setState({
          status: 'ready',
          image,
          size: { width: image.naturalWidth, height: image.naturalHeight },
        });
    };
    image.onerror = () => {
      if (!cancelled) setState({ status: 'error' });
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return state;
}

/** Frame size for the available width: the crop aspect, at most MAX_FRAME_HEIGHT tall. */
function frameFor(availableWidth: number, aspect: number): Size {
  const width = Math.min(availableWidth, MAX_FRAME_HEIGHT * aspect);
  return { width, height: width / aspect };
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, OUTPUT_QUALITY));
}

/**
 * Delta Lektorat-style crop dialog: a fixed frame in the field's aspect ratio, the image moved
 * (drag, arrow keys), zoomed (slider, wheel, pinch), straightened, turned by 90° and flipped
 * beneath it. Apply exports exactly what the frame shows as webp (jpeg where unsupported).
 */
export const ImageCropDialog: React.FC<ImageCropDialogProps> = ({
  open,
  label,
  src,
  crop,
  onCancel,
  onApply,
}) => {
  const load = useLoadedImage(open ? src : null);
  const [transform, setTransform] = useState<CropTransform>(INITIAL_TRANSFORM);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinchDistance = useRef<number | null>(null);

  const frame = frameFor(availableWidth, crop.aspect);
  const image = load.status === 'ready' ? load : null;

  // A new image starts uncropped
  useEffect(() => setTransform(INITIAL_TRANSFORM), [src]);

  // Measure the dialog's content width (the frame follows it)
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!open || !container) return;
    const observer = new ResizeObserver(([entry]) =>
      setAvailableWidth(Math.floor(entry!.contentRect.width)),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [open, load.status]);

  const update = useCallback(
    (change: (current: CropTransform) => CropTransform) => {
      if (!image || frame.width === 0) return;
      setTransform((current) => normalizeTransform(change(current), image.size, frame));
    },
    [image, frame.width, frame.height],
  );

  // Redraw the preview on every change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || frame.width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(frame.width * ratio);
    canvas.height = Math.round(frame.height * ratio);
    const context = canvas.getContext('2d');
    if (context) drawCrop(context, image.image, image.size, frame, transform, ratio);
  }, [image, transform, frame.width, frame.height]);

  // Wheel zoom: a native listener, React's is passive and can't stop the page from scrolling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.002);
      update((current) => ({ ...current, zoom: current.zoom * factor }));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [update, image]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinchDistance.current = null;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);

    if (pointers.current.size === 2) {
      // Pinch: zoom by the change in distance between the two fingers
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance.current) {
        const factor = distance / pinchDistance.current;
        update((current) => ({ ...current, zoom: current.zoom * factor }));
      }
      pinchDistance.current = distance;
      return;
    }
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    update((current) => ({
      ...current,
      offset: { x: current.offset.x + dx, y: current.offset.y + dy },
    }));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    pinchDistance.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const step = event.shiftKey ? KEY_MOVE_FAST : KEY_MOVE;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    update((current) => ({
      ...current,
      offset: { x: current.offset.x + move.x, y: current.offset.y + move.y },
    }));
  };

  const output = image ? outputSize(image.size, frame, transform, crop.outputWidth) : null;

  const apply = async () => {
    if (!image || !output) return;
    setIsApplying(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = output.width;
      canvas.height = output.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is not available');
      drawCrop(context, image.image, image.size, frame, transform, output.width / frame.width);
      // Safari < 17 has no webp encoder: it returns png, so fall back to jpeg then
      let blob = await toBlob(canvas, 'image/webp');
      if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg');
      if (!blob) throw new Error('Could not export the image');
      await onApply(blob);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onClose={isApplying ? undefined : onCancel} maxWidth="md" fullWidth>
      <DialogTitle>Crop image — {label}</DialogTitle>
      <DialogContent>
        <Box ref={containerRef} sx={{ width: '100%' }}>
          {load.status === 'loading' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          )}
          {load.status === 'error' && (
            <Alert severity="error">
              This image can’t be opened for cropping (its host doesn’t allow it). Choose the file
              again with Replace to crop it.
            </Alert>
          )}
          {image && (
            <>
              <Box
                sx={{
                  position: 'relative',
                  width: frame.width,
                  height: frame.height,
                  mx: 'auto',
                  bgcolor: 'common.black',
                  overflow: 'hidden',
                  borderRadius: 1,
                  touchAction: 'none',
                }}
              >
                <canvas
                  ref={canvasRef}
                  tabIndex={0}
                  role="img"
                  aria-label={`Crop area for ${label}: drag or use the arrow keys to move the image`}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={onKeyDown}
                  style={{
                    width: frame.width,
                    height: frame.height,
                    display: 'block',
                    cursor: 'grab',
                    outline: 'none',
                  }}
                />
                {/* Rule-of-thirds grid and, for round images, the circle the website shows */}
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    backgroundImage:
                      'linear-gradient(to right, transparent calc(33.33% - 0.5px), rgba(255,255,255,0.5) calc(33.33% - 0.5px), rgba(255,255,255,0.5) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgba(255,255,255,0.5) calc(66.66% - 0.5px), rgba(255,255,255,0.5) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px)), linear-gradient(to bottom, transparent calc(33.33% - 0.5px), rgba(255,255,255,0.5) calc(33.33% - 0.5px), rgba(255,255,255,0.5) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgba(255,255,255,0.5) calc(66.66% - 0.5px), rgba(255,255,255,0.5) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px))',
                  }}
                />
                {crop.shape === 'circle' && (
                  <Box
                    aria-hidden
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      borderRadius: '50%',
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.8)',
                    }}
                  />
                )}
              </Box>

              <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mt: 2 }}>
                <IconButton
                  aria-label="Zoom out"
                  onClick={() => update((c) => ({ ...c, zoom: c.zoom - ZOOM_STEP * 2 }))}
                >
                  <ZoomOut />
                </IconButton>
                <Slider
                  aria-label="Zoom"
                  min={1}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={transform.zoom}
                  onChange={(_, value) => update((c) => ({ ...c, zoom: value as number }))}
                />
                <IconButton
                  aria-label="Zoom in"
                  onClick={() => update((c) => ({ ...c, zoom: c.zoom + ZOOM_STEP * 2 }))}
                >
                  <ZoomIn />
                </IconButton>
              </Stack>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <IconButton
                  aria-label="Rotate left"
                  onClick={() => update((c) => ({ ...c, quarterTurns: c.quarterTurns - 1 }))}
                >
                  <RotateLeft />
                </IconButton>
                <Slider
                  aria-label="Straighten"
                  min={-STRAIGHTEN_LIMIT}
                  max={STRAIGHTEN_LIMIT}
                  step={0.5}
                  track={false}
                  marks={[{ value: 0 }]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}°`}
                  value={transform.straighten}
                  onChange={(_, value) => update((c) => ({ ...c, straighten: value as number }))}
                />
                <IconButton
                  aria-label="Rotate right"
                  onClick={() => update((c) => ({ ...c, quarterTurns: c.quarterTurns + 1 }))}
                >
                  <RotateRight />
                </IconButton>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={<Flip />}
                  aria-label="Flip horizontally"
                  aria-pressed={transform.flipHorizontal}
                  onClick={() => update((c) => ({ ...c, flipHorizontal: !c.flipHorizontal }))}
                >
                  Flip H
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={<Flip sx={{ transform: 'rotate(90deg)' }} />}
                  aria-label="Flip vertically"
                  aria-pressed={transform.flipVertical}
                  onClick={() => update((c) => ({ ...c, flipVertical: !c.flipVertical }))}
                >
                  Flip V
                </Button>
                <Button
                  size="small"
                  startIcon={<RestartAlt />}
                  disabled={isUntouched(transform)}
                  onClick={() => setTransform(INITIAL_TRANSFORM)}
                >
                  Reset
                </Button>
              </Stack>
              {output && (
                <Typography variant="body2" sx={{ mt: 2 }}>
                  Output {output.width} × {output.height} px
                  {output.width < crop.outputWidth &&
                    ` (the source has fewer pixels than the ${crop.outputWidth} px target)`}
                </Typography>
              )}
              <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 1 }}>
                Drag to move, scroll or pinch to zoom; arrow keys move the image when it has focus.
              </Typography>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isApplying}>
          Cancel
        </Button>
        <Button variant="contained" onClick={apply} disabled={!image || isApplying}>
          {isApplying ? 'Uploading…' : 'Apply crop'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
