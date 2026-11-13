import React from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControlLabel,
  MenuItem,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  COVER_SIZES,
  TEXT_LIMITS,
  TITLE_SCALE,
  type CoverAlignment,
  type CoverSizeId,
  type CoverState,
} from './coverConfig';

export type CoverFieldChange = <K extends keyof CoverState>(key: K, value: CoverState[K]) => void;

interface CoverControlsProps {
  state: CoverState;
  onChange: CoverFieldChange;
}

const ALIGNMENT_OPTIONS: { label: string; value: CoverAlignment }[] = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
];

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="overline" component="h3" sx={{ color: 'text.secondary' }}>
    {children}
  </Typography>
);

/** Text field with an on/off switch in its header (subtitle). */
const ToggleableTextField: React.FC<{
  id: string;
  label: string;
  value: string;
  enabled: boolean;
  maxLength: number;
  multiline?: boolean;
  onValueChange: (value: string) => void;
  onEnabledChange: (enabled: boolean) => void;
}> = ({ id, label, value, enabled, maxLength, multiline, onValueChange, onEnabledChange }) => (
  <Box>
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography component="label" htmlFor={id} variant="subtitle2">
        {label}
      </Typography>
      <Switch
        size="small"
        checked={enabled}
        onChange={(event) => onEnabledChange(event.target.checked)}
        slotProps={{ input: { 'aria-label': `Show ${label.toLowerCase()}` } }}
      />
    </Stack>
    <TextField
      id={id}
      value={value}
      disabled={!enabled}
      onChange={(event) => onValueChange(event.target.value)}
      multiline={multiline}
      minRows={multiline ? 2 : undefined}
      maxRows={multiline ? 4 : undefined}
      slotProps={{ htmlInput: { maxLength } }}
      margin="none"
    />
  </Box>
);

export const CoverControls: React.FC<CoverControlsProps> = ({ state, onChange }) => (
  <Card>
    <CardContent>
      <Stack spacing={3}>
        <Stack spacing={1.5}>
          <SectionTitle>Text</SectionTitle>
          {/* Labels sit above every field (as on Subtitle, whose header holds a switch) */}
          <Box>
            <Typography component="label" htmlFor="cover-title" variant="subtitle2">
              Title
            </Typography>
            <TextField
              id="cover-title"
              value={state.title}
              onChange={(event) => onChange('title', event.target.value)}
              multiline
              minRows={2}
              maxRows={4}
              slotProps={{ htmlInput: { maxLength: TEXT_LIMITS.title } }}
              margin="none"
              sx={{ mt: 0.5 }}
            />
          </Box>
          <ToggleableTextField
            id="cover-subtitle"
            label="Subtitle"
            value={state.subtitle}
            enabled={state.showSubtitle}
            maxLength={TEXT_LIMITS.subtitle}
            multiline
            onValueChange={(value) => onChange('subtitle', value)}
            onEnabledChange={(enabled) => onChange('showSubtitle', enabled)}
          />
        </Stack>

        <Stack spacing={1.5}>
          <SectionTitle>Layout</SectionTitle>
          <Box>
            <Typography variant="subtitle2" id="cover-size-label" sx={{ mb: 0.5 }}>
              Output size
            </Typography>
            <TextField
              select
              id="cover-size"
              value={state.sizeId}
              onChange={(event) => onChange('sizeId', event.target.value as CoverSizeId)}
              margin="none"
              slotProps={{ select: { labelId: 'cover-size-label' } }}
            >
              {COVER_SIZES.map((preset) => (
                <MenuItem key={preset.id} value={preset.id}>
                  {preset.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box>
            <Typography variant="subtitle2" id="cover-alignment-label" sx={{ mb: 0.5 }}>
              Alignment
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={state.alignment}
              onChange={(_event, value: CoverAlignment | null) =>
                value && onChange('alignment', value)
              }
              aria-labelledby="cover-alignment-label"
            >
              {ALIGNMENT_OPTIONS.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <Box>
            <Typography variant="subtitle2" id="cover-title-scale-label">
              Title size{' '}
              <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                {state.titleScale.toFixed(2)}×
              </Box>
            </Typography>
            <Slider
              min={TITLE_SCALE.min}
              max={TITLE_SCALE.max}
              step={TITLE_SCALE.step}
              value={state.titleScale}
              onChange={(_event, value) => onChange('titleScale', value as number)}
              aria-labelledby="cover-title-scale-label"
              size="small"
            />
          </Box>
        </Stack>

        <Stack spacing={1.5}>
          <SectionTitle>Style</SectionTitle>
          <FormControlLabel
            control={
              <Switch
                checked={state.vignette}
                onChange={(event) => onChange('vignette', event.target.checked)}
              />
            }
            label="Vignette"
            sx={{ ml: 0, justifyContent: 'space-between' }}
            labelPlacement="start"
          />
        </Stack>
      </Stack>
    </CardContent>
  </Card>
);
