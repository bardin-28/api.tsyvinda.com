import { SCENE_BG_COLOR, type CoverState } from './coverConfig';

// 2D layer of the cover: backdrop copy, vignette and the text blocks. Ported from the
// website's cover generator so both produce the same layout.

export interface WrappedLine {
  text: string;
  width: number;
}

/** Greedy word wrap; a single word wider than `maxWidth` keeps its own line. */
export function wrapText(
  context: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  maxWidth: number,
): WrappedLine[] {
  if (!text.trim()) return [];
  const words = text.trim().split(/\s+/);
  const lines: WrappedLine[] = [];
  let currentLine = '';
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && currentLine) {
      lines.push({ text: currentLine, width: context.measureText(currentLine).width });
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine) {
    lines.push({ text: currentLine, width: context.measureText(currentLine).width });
  }
  return lines;
}

interface TextBlock {
  lines: WrappedLine[];
  size: number;
  /** Baseline-to-baseline distance */
  gap: number;
  color: string;
  weight: number;
}

interface PaintFrameInput {
  context: CanvasRenderingContext2D;
  backdrop: CanvasImageSource;
  state: CoverState;
  fontFamily: string;
  width: number;
  height: number;
}

function paintVignette(context: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.max(width, height) / 1.35,
  );
  gradient.addColorStop(0, 'rgba(8, 8, 16, 0.0)');
  gradient.addColorStop(1, 'rgba(8, 8, 16, 0.78)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

/** Paints one complete cover frame onto `context`. */
export function paintCoverFrame({
  context,
  backdrop,
  state,
  fontFamily,
  width,
  height,
}: PaintFrameInput): void {
  context.fillStyle = SCENE_BG_COLOR;
  context.fillRect(0, 0, width, height);
  context.drawImage(backdrop, 0, 0, width, height);
  if (state.vignette) paintVignette(context, width, height);

  const padding = Math.round(width * 0.06);
  const innerWidth = width - padding * 2;
  let anchorX: number;
  let textAlign: CanvasTextAlign;
  if (state.alignment === 'center') {
    anchorX = width / 2;
    textAlign = 'center';
  } else if (state.alignment === 'right') {
    anchorX = width - padding;
    textAlign = 'right';
  } else {
    anchorX = padding;
    textAlign = 'left';
  }

  const titleSize = Math.round(Math.round(height * 0.13) * state.titleScale);
  const subtitleSize = Math.round(titleSize * 0.36);

  context.textBaseline = 'alphabetic';
  context.textAlign = textAlign;

  const blocks: TextBlock[] = [];

  context.font = `700 ${titleSize}px ${fontFamily}`;
  const titleLines = wrapText(context, state.title, innerWidth);
  if (titleLines.length > 0) {
    blocks.push({
      lines: titleLines,
      size: titleSize,
      gap: Math.round(titleSize * 1.08),
      color: '#ffffff',
      weight: 700,
    });
  }

  if (state.showSubtitle && state.subtitle.trim()) {
    context.font = `500 ${subtitleSize}px ${fontFamily}`;
    const subtitleLines = wrapText(context, state.subtitle, innerWidth);
    if (subtitleLines.length > 0) {
      blocks.push({
        lines: subtitleLines,
        size: subtitleSize,
        gap: Math.round(subtitleSize * 1.4),
        color: 'rgba(255,255,255,0.78)',
        weight: 500,
      });
    }
  }

  layoutTextBlocks(blocks, height).forEach(({ block, firstBaselineY }) => {
    context.fillStyle = block.color;
    context.font = `${block.weight} ${block.size}px ${fontFamily}`;

    block.lines.forEach((line, lineIndex) => {
      context.fillText(line.text, anchorX, firstBaselineY + lineIndex * block.gap);
    });
  });
}

/** Space after a block, relative to its font size */
const BLOCK_SPACING_RATIO = 0.55;
/** First baseline sits this far (relative to font size) below the block's top edge */
const ASCENT_RATIO = 0.85;

/**
 * Stacks the blocks top to bottom, vertically centered: each block is `lines × gap` tall and
 * followed by spacing. Every block's first baseline is placed from its own top edge, so the
 * gap between blocks scales with the block above, not with the next block's font size.
 */
export function layoutTextBlocks<Block extends Pick<TextBlock, 'lines' | 'size' | 'gap'>>(
  blocks: Block[],
  canvasHeight: number,
): { block: Block; firstBaselineY: number }[] {
  const spacingAfter = (block: Block, index: number) =>
    index < blocks.length - 1 ? Math.round(block.size * BLOCK_SPACING_RATIO) : 0;

  const totalHeight = blocks.reduce(
    (sum, block, index) => sum + block.lines.length * block.gap + spacingAfter(block, index),
    0,
  );

  let blockTop = Math.round((canvasHeight - totalHeight) / 2);
  return blocks.map((block, index) => {
    const firstBaselineY = blockTop + Math.round(block.size * ASCENT_RATIO);
    blockTop += block.lines.length * block.gap + spacingAfter(block, index);
    return { block, firstBaselineY };
  });
}
