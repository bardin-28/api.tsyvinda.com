import React, { useState } from 'react';
import { TextInput, useInput } from 'react-admin';
import {
  ClearButtons,
  FormatButtons,
  ImageButtons,
  LevelSelect,
  LinkButtons,
  ListButtons,
  QuoteButtons,
  RichTextInput,
  RichTextInputToolbar,
} from 'ra-input-rich-text';
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Code, TextFields } from '@mui/icons-material';
import { monoFontFamily } from '../theme';

export type EditorMode = 'visual' | 'html';

const OPENING_BLOCK =
  /\s*(<(?:p|h[1-6]|ul|ol|li|blockquote|pre|div|hr|figure|table|thead|tbody|tr)\b)/g;
// Containers only: a break before </p> or </li> would put whitespace inside the text.
const CLOSING_CONTAINER = /\s*(<\/(?:ul|ol|blockquote|div|figure|table|thead|tbody|tr)>)/g;

/**
 * One block per line so the HTML view is readable (the visual editor emits a single line).
 * Adds whitespace between blocks only, so the rendered page is unchanged.
 */
export function formatHtml(html: string): string {
  return html.replace(OPENING_BLOCK, '\n$1').replace(CLOSING_CONTAINER, '\n$1').replace(/^\n/, '');
}

export interface HtmlEditorInputProps {
  source: string;
  label: string;
  /** Starting mode; defaults to the visual editor */
  defaultMode?: EditorMode;
}

/**
 * Rich-text field with a Visual / HTML switch. Visual = ra-input-rich-text (TipTap); HTML = the raw
 * markup in a code-style textarea. Both edit the same form value.
 */
export const HtmlEditorInput: React.FC<HtmlEditorInputProps> = ({
  source,
  label,
  defaultMode = 'visual',
}) => {
  const [mode, setMode] = useState<EditorMode>(defaultMode);
  const { field } = useInput({ source });

  const switchMode = (_: React.MouseEvent, next: EditorMode | null) => {
    if (!next || next === mode) return;
    if (next === 'html' && typeof field.value === 'string') {
      const formatted = formatHtml(field.value);
      if (formatted !== field.value) field.onChange(formatted);
    }
    setMode(next);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="subtitle2" component="span" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={switchMode}
          aria-label="Editor mode"
        >
          <ToggleButton value="visual" aria-label="Visual editor">
            <TextFields fontSize="small" sx={{ mr: 0.5 }} />
            Visual
          </ToggleButton>
          <ToggleButton value="html" aria-label="HTML source">
            <Code fontSize="small" sx={{ mr: 0.5 }} />
            HTML
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {mode === 'visual' ? (
        <RichTextInput
          source={source}
          label={false}
          fullWidth
          toolbar={
            <RichTextInputToolbar size="small">
              <LevelSelect size="small" />
              <FormatButtons size="small" />
              <ListButtons size="small" />
              <LinkButtons size="small" />
              <ImageButtons size="small" />
              <QuoteButtons size="small" />
              <ClearButtons size="small" />
            </RichTextInputToolbar>
          }
          helperText="Markup the visual editor doesn't support is dropped once you edit here — use HTML for it."
          sx={{ '& .ProseMirror': { minHeight: 320 } }}
        />
      ) : (
        <TextInput
          source={source}
          label={false}
          multiline
          minRows={16}
          fullWidth
          helperText="Raw HTML, rendered as-is on the website."
          slotProps={{
            htmlInput: {
              spellCheck: false,
              'aria-label': `${label} HTML`,
              style: { fontFamily: monoFontFamily, fontSize: 13, lineHeight: 1.6 },
            },
          }}
        />
      )}
    </Box>
  );
};
