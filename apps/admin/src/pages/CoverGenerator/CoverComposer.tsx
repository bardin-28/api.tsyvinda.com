import React, { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { Box } from '@mui/material';
import {
  COVER_FONT_FAMILY,
  COVER_JPEG_QUALITY,
  getSizePreset,
  type CoverState,
} from './coverConfig';
import { createCoverScene, disposeCoverScene, renderCoverSceneFrame } from './coverScene';
import { paintCoverFrame } from './coverPaint';

export interface CoverComposerHandle {
  /** Encodes the current frame as JPEG at the full output size. */
  toJpegBlob: () => Promise<Blob>;
}

interface CoverComposerProps {
  state: CoverState;
  ref?: Ref<CoverComposerHandle>;
}

/**
 * Live preview canvas: every animation frame renders the 3D backdrop off-screen and paints
 * it plus the text at the real output size; CSS only scales it down for display.
 */
export const CoverComposer: React.FC<CoverComposerProps> = ({ state, ref }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // The loop reads the latest state without restarting the scene on every keystroke.
  const stateRef = useRef<CoverState>(state);
  const { width, height } = getSizePreset(state.sizeId);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // A new output size needs a new WebGL renderer; text/style changes do not.
  useEffect(() => {
    const outputCanvas = canvasRef.current;
    const outputContext = outputCanvas?.getContext('2d');
    if (!outputCanvas || !outputContext) return;

    let cancelled = false;
    let animationFrameId = 0;
    const coverScene = createCoverScene(width, height);

    const loop = () => {
      if (cancelled) return;
      animationFrameId = requestAnimationFrame(loop);
      renderCoverSceneFrame(coverScene);
      paintCoverFrame({
        context: outputContext,
        backdrop: coverScene.renderer.domElement,
        state: stateRef.current,
        fontFamily: COVER_FONT_FAMILY,
        width,
        height,
      });
    };

    // Wait for web fonts so the first frames do not measure text with a fallback font.
    void document.fonts.ready.catch(() => undefined).then(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrameId);
      disposeCoverScene(coverScene);
    };
  }, [width, height]);

  useImperativeHandle(
    ref,
    () => ({
      toJpegBlob: () =>
        new Promise<Blob>((resolve, reject) => {
          const canvas = canvasRef.current;
          if (!canvas) {
            reject(new Error('Cover preview is not ready'));
            return;
          }
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode JPEG'))),
            'image/jpeg',
            COVER_JPEG_QUALITY,
          );
        }),
    }),
    [],
  );

  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        bgcolor: '#080810',
        lineHeight: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        aria-label="Cover preview"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
    </Box>
  );
};
