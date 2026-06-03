import type { CSSProperties } from 'react';

/**
 * Inline style objects for the WelcomeEmail template.
 *
 * Kept in a dedicated module (no Tailwind, no external .css) because email
 * delivery requires inlined styles — clients such as Gmail strip <head><style>
 * and external stylesheets. Applied via `style={...}` props in the template.
 *
 * Palette mirrors the frontend (test-fe) dark theme + brand accent:
 *   bg #080810, card #15151d, text #ffffff/#d4d4d8, accent #fd7e14, font Roboto.
 * Hex values only (rgba/CSS vars are unreliable across email clients).
 */

const FONT_STACK =
  'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export const main: CSSProperties = {
  backgroundColor: '#080810',
  fontFamily: FONT_STACK,
  margin: 0,
  padding: 0,
};

export const container: CSSProperties = {
  backgroundColor: '#15151d',
  border: '1px solid #2b2b34',
  borderRadius: '12px',
  margin: '40px auto',
  maxWidth: '465px',
  padding: '32px',
};

export const heading: CSSProperties = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 700,
  margin: '0 0 16px',
};

export const paragraph: CSSProperties = {
  color: '#d4d4d8',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 24px',
};

export const button: CSSProperties = {
  backgroundColor: '#fd7e14',
  borderRadius: '8px',
  color: '#080810',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: 700,
  padding: '12px 20px',
  textDecoration: 'none',
};

export const mutedParagraph: CSSProperties = {
  color: '#8a8a93',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '24px 0 0',
  wordBreak: 'break-all',
};

export const link: CSSProperties = {
  color: '#fd7e14',
  textDecoration: 'underline',
};
