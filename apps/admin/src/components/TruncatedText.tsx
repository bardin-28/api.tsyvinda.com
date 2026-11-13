import React, { useState } from 'react';
import { useFieldValue, type FieldProps } from 'react-admin';
import { Box, Tooltip } from '@mui/material';
import { cellMaxWidth, EMPTY_CELL } from '../theme';

interface TruncatedTextProps {
  text: string | null | undefined;
  maxWidth?: number;
}

/**
 * One-line text capped at `maxWidth` that ends in an ellipsis when it overflows. Hovering
 * truncated text shows the full value in a tooltip; text that fits shows no tooltip.
 */
export const TruncatedText: React.FC<TruncatedTextProps> = ({ text, maxWidth = cellMaxWidth }) => {
  const [isTruncated, setIsTruncated] = useState<boolean>(false);

  if (!text) return <>{EMPTY_CELL}</>;

  return (
    <Tooltip title={isTruncated ? text : ''} placement="bottom-start" enterDelay={300}>
      <Box
        component="span"
        // Measured on hover, so resizing the window or column is always reflected.
        onMouseEnter={(event: React.MouseEvent<HTMLSpanElement>) =>
          setIsTruncated(event.currentTarget.scrollWidth > event.currentTarget.clientWidth)
        }
        sx={{
          display: 'block',
          maxWidth,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </Box>
    </Tooltip>
  );
};

interface TruncatedTextFieldProps extends FieldProps {
  source: string;
  maxWidth?: number;
}

/** RA field version of TruncatedText: reads `source` from the current record. */
export const TruncatedTextField: React.FC<TruncatedTextFieldProps> = ({ source, maxWidth }) => {
  const value = useFieldValue({ source });
  return <TruncatedText text={value == null ? null : String(value)} maxWidth={maxWidth} />;
};
