/**
 * Geometry of the image crop dialog. The crop frame is fixed (the dialog's viewport, in the
 * field's aspect ratio); the image is moved, zoomed, rotated and flipped underneath it and must
 * always cover the whole frame. Pure functions, so the dialog and the exported file agree.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface CropTransform {
  /** 1 = the smallest scale that still covers the frame; up to MAX_ZOOM */
  zoom: number;
  /** Quarter turns, 0–3 (Rotate left / right) */
  quarterTurns: number;
  /** Fine rotation in degrees, −45…45 (Straighten) */
  straighten: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  /** Image centre relative to the frame centre, in frame pixels */
  offset: Point;
}

export const MAX_ZOOM = 4;
export const STRAIGHTEN_LIMIT = 45;

export const INITIAL_TRANSFORM: CropTransform = {
  zoom: 1,
  quarterTurns: 0,
  straighten: 0,
  flipHorizontal: false,
  flipVertical: false,
  offset: { x: 0, y: 0 },
};

/** Total rotation in radians. */
export function rotationRadians(transform: CropTransform): number {
  return ((transform.quarterTurns * 90 + transform.straighten) * Math.PI) / 180;
}

/**
 * The frame's bounding box measured along the rotated image's axes: what the image has to
 * cover. (A rectangle rotated by θ inside another needs w·|cos|+h·|sin| by w·|sin|+h·|cos|.)
 */
function frameInImageAxes(frame: Size, radians: number): Size {
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    width: frame.width * cos + frame.height * sin,
    height: frame.width * sin + frame.height * cos,
  };
}

/** Smallest image scale (frame px per source px) at which the rotated image covers the frame. */
export function coverScale(image: Size, frame: Size, radians: number): number {
  const needed = frameInImageAxes(frame, radians);
  return Math.max(needed.width / image.width, needed.height / image.height);
}

/** Image scale for a transform: the cover scale times the zoom. */
export function imageScale(image: Size, frame: Size, transform: CropTransform): number {
  return coverScale(image, frame, rotationRadians(transform)) * transform.zoom;
}

/**
 * Keeps the frame inside the image: limits how far the image may move, measured along its
 * own (rotated) axes, then converts back to frame coordinates.
 */
export function clampOffset(
  offset: Point,
  image: Size,
  frame: Size,
  transform: Omit<CropTransform, 'offset'>,
): Point {
  const radians = rotationRadians({ ...transform, offset });
  const scale = imageScale(image, frame, { ...transform, offset });
  const needed = frameInImageAxes(frame, radians);
  const maxX = Math.max(0, (image.width * scale - needed.width) / 2);
  const maxY = Math.max(0, (image.height * scale - needed.height) / 2);

  // Offset in the image's axes (rotate by −θ), clamp, rotate back
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const alongX = offset.x * cos + offset.y * sin;
  const alongY = -offset.x * sin + offset.y * cos;
  const clampedX = Math.min(maxX, Math.max(-maxX, alongX));
  const clampedY = Math.min(maxY, Math.max(-maxY, alongY));
  return {
    x: clampedX * cos - clampedY * sin,
    y: clampedX * sin + clampedY * cos,
  };
}

/** Clamps zoom and offset after any change (zooming out or rotating can expose an edge). */
export function normalizeTransform(
  transform: CropTransform,
  image: Size,
  frame: Size,
): CropTransform {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, transform.zoom));
  const straighten = Math.min(STRAIGHTEN_LIMIT, Math.max(-STRAIGHTEN_LIMIT, transform.straighten));
  const quarterTurns = ((transform.quarterTurns % 4) + 4) % 4;
  const next = { ...transform, zoom, straighten, quarterTurns };
  return { ...next, offset: clampOffset(transform.offset, image, frame, next) };
}

/**
 * Size of the exported file: the frame's aspect at `maxWidth`, but never larger than the source
 * pixels inside the frame (no upscaling).
 */
export function outputSize(
  image: Size,
  frame: Size,
  transform: CropTransform,
  maxWidth: number,
): Size {
  const scale = imageScale(image, frame, transform);
  const sourceWidth = frame.width / scale;
  const width = Math.max(1, Math.floor(Math.min(maxWidth, sourceWidth)));
  return { width, height: Math.max(1, Math.round((width * frame.height) / frame.width)) };
}

/**
 * Draws the image as it sits under the frame onto a canvas context whose size is `frame` scaled
 * by `pixelRatio` (1 for the on-screen preview's CSS size, output/frame width for the export).
 */
export function drawCrop(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  image: Size,
  frame: Size,
  transform: CropTransform,
  pixelRatio: number,
): void {
  const scale = imageScale(image, frame, transform);
  context.save();
  context.scale(pixelRatio, pixelRatio);
  context.clearRect(0, 0, frame.width, frame.height);
  context.translate(frame.width / 2 + transform.offset.x, frame.height / 2 + transform.offset.y);
  context.rotate(rotationRadians(transform));
  context.scale(
    (transform.flipHorizontal ? -1 : 1) * scale,
    (transform.flipVertical ? -1 : 1) * scale,
  );
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, -image.width / 2, -image.height / 2, image.width, image.height);
  context.restore();
}

/** True when the transform changes nothing (Reset state). */
export function isUntouched(transform: CropTransform): boolean {
  return (
    transform.zoom === 1 &&
    transform.quarterTurns === 0 &&
    transform.straighten === 0 &&
    !transform.flipHorizontal &&
    !transform.flipVertical &&
    transform.offset.x === 0 &&
    transform.offset.y === 0
  );
}
