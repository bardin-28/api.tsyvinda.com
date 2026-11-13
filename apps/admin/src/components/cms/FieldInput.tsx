import React from 'react';
import {
  ArrayInput,
  BooleanInput,
  DateInput,
  NumberInput,
  SelectInput,
  SimpleFormIterator,
  TextInput,
  maxLength,
} from 'react-admin';
import { useWatch } from 'react-hook-form';
import { Box, Typography } from '@mui/material';
import {
  DEFAULT_MULTILINE_MAX,
  DEFAULT_TEXT_MAX,
  PAGE_DEFINITIONS,
  PAGE_KEYS,
  type FieldDefinition,
  type FieldDefinitions,
  type Locale,
} from '@tsyvinda/shared-types';
import { HtmlEditorInput } from '../HtmlEditorInput';
import { ImageFieldInput } from './ImageFieldInput';

const PAGE_CHOICES = PAGE_KEYS.map((key) => ({ id: key, name: PAGE_DEFINITIONS[key].label }));

/** A strings field is edited as one entry per line. */
const formatLines = (value: unknown): string => (Array.isArray(value) ? value.join('\n') : '');
const parseLines = (value: string): string[] => (value ? value.split('\n') : []);

const MARKUP_HELP =
  'Use <accent>…</accent> to highlight, <strong>…</strong> for bold, <br></br> for a line break';

function helperText(def: FieldDefinition, localized: boolean, locale: Locale): string | undefined {
  const parts = [
    def.help,
    def.kind === 'text' && def.markup ? MARKUP_HELP : undefined,
    def.kind === 'strings' ? 'One per line' : undefined,
    localized ? `In ${locale.toUpperCase()}` : undefined,
    def.required ? 'Required' : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

/** "22 characters, recommended: 30–60", for texts with a recommended length (SEO). */
export function lengthHint(length: number, recommended: { min: number; max: number }): string {
  return `${length} characters, recommended: ${recommended.min}–${recommended.max}`;
}

/** Text input whose helper text counts characters against the recommended length. */
const CountedTextInput: React.FC<{
  source: string;
  label: string;
  multiline?: boolean;
  max: number;
  recommended: { min: number; max: number };
  helperText?: string;
}> = ({ source, label, multiline, max, recommended, helperText: help }) => {
  const value = useWatch({ name: source }) as unknown;
  const length = typeof value === 'string' ? value.trim().length : 0;
  const outside = length > 0 && (length < recommended.min || length > recommended.max);
  return (
    <TextInput
      source={source}
      label={label}
      multiline={multiline}
      minRows={multiline ? 2 : undefined}
      validate={maxLength(max)}
      helperText={
        <>
          <Box
            component="span"
            sx={{ color: outside ? 'warning.main' : undefined, fontWeight: outside ? 600 : 400 }}
          >
            {lengthHint(length, recommended)}
          </Box>
          {help ? ` · ${help}` : ''}
        </>
      }
    />
  );
};

export interface FieldInputProps {
  name: string;
  def: FieldDefinition;
  /** Language whose half of translated fields is edited */
  locale: Locale;
  /** Form path of the object holding this field ("draft.blocks.0.data"); "" inside an iterator */
  base?: string;
}

const join = (base: string | undefined, name: string) => (base ? `${base}.${name}` : name);

/**
 * One CMS field (definition from @tsyvinda/shared-types) as a react-admin input. Translated
 * fields bind to `<field>.<locale>`, so every language lives in the same form value.
 */
export const FieldInput: React.FC<FieldInputProps> = ({ name, def, locale, base }) => {
  const source = join(base, name);
  switch (def.kind) {
    case 'text': {
      const max = def.max ?? (def.multiline ? DEFAULT_MULTILINE_MAX : DEFAULT_TEXT_MAX);
      if (def.recommendedLength) {
        return (
          <CountedTextInput
            source={def.localized ? `${source}.${locale}` : source}
            label={def.label}
            multiline={def.multiline}
            max={max}
            recommended={def.recommendedLength}
            helperText={helperText(def, def.localized, locale)}
          />
        );
      }
      return (
        <TextInput
          source={def.localized ? `${source}.${locale}` : source}
          label={def.label}
          multiline={def.multiline}
          minRows={def.multiline ? 2 : undefined}
          validate={maxLength(max)}
          helperText={helperText(def, def.localized, locale)}
        />
      );
    }
    case 'strings':
      return (
        <TextInput
          source={def.localized ? `${source}.${locale}` : source}
          label={def.label}
          multiline
          minRows={3}
          format={formatLines}
          parse={parseLines}
          helperText={helperText(def, def.localized, locale)}
        />
      );
    case 'richText':
      return (
        <Box sx={{ width: '100%' }}>
          <HtmlEditorInput
            source={`${source}.${locale}`}
            label={`${def.label} (${locale.toUpperCase()})`}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Link to another page with the address page:&lt;key&gt; (e.g. page:about); it follows the
            page’s URL.
          </Typography>
        </Box>
      );
    case 'number':
      return (
        <NumberInput
          source={source}
          label={def.label}
          min={def.min}
          max={def.max}
          step={1}
          helperText={helperText(def, false, locale)}
        />
      );
    case 'date':
      return (
        <DateInput source={source} label={def.label} helperText={helperText(def, false, locale)} />
      );
    case 'boolean':
      return <BooleanInput source={source} label={def.label} helperText={def.help} />;
    case 'image':
      return (
        <ImageFieldInput
          source={source}
          label={def.label}
          helperText={helperText(def, false, locale)}
          crop={def.crop}
        />
      );
    case 'pageLink':
      return (
        <SelectInput
          source={source}
          label={def.label}
          choices={PAGE_CHOICES}
          emptyText="—"
          helperText={helperText(def, false, locale)}
        />
      );
    case 'list':
      return (
        <ArrayInput source={source} label={def.label} helperText={def.help}>
          <SimpleFormIterator inline={false} disableClear>
            <FieldInputs defs={def.item} locale={locale} />
          </SimpleFormIterator>
        </ArrayInput>
      );
    case 'group':
      // A group of one field needs no frame: the field's own label says it all
      if (Object.keys(def.fields).length === 1)
        return <FieldInputs defs={def.fields} locale={locale} base={source} />;
      return (
        <Box
          component="fieldset"
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            px: 2,
            pt: 1,
            pb: 2,
            m: 0,
            mt: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Typography component="legend" variant="subtitle2" sx={{ px: 0.5 }}>
            {def.label}
          </Typography>
          <FieldInputs defs={def.fields} locale={locale} base={source} />
        </Box>
      );
  }
};

/** Every field of a definition, in order. */
export const FieldInputs: React.FC<{ defs: FieldDefinitions; locale: Locale; base?: string }> = ({
  defs,
  locale,
  base,
}) => (
  <>
    {Object.entries(defs).map(([name, def]) => (
      <FieldInput key={name} name={name} def={def} locale={locale} base={base} />
    ))}
  </>
);
