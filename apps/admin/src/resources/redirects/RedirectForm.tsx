import React from 'react';
import {
  BooleanInput,
  Create,
  Edit,
  RadioButtonGroupInput,
  SimpleForm,
  TextInput,
  maxLength,
  required,
} from 'react-admin';
import { REDIRECT_TYPES } from '@tsyvinda/shared-types';

const TYPE_CHOICES = REDIRECT_TYPES.map((type) => ({
  id: type,
  name: type === 'permanent' ? 'Permanent (308) — moved for good' : 'Temporary (307)',
}));

const sourcePath = (value: string) =>
  value && !/^\/[^/]/.test(value.trim())
    ? 'A path starting with "/", e.g. /uk/old-page'
    : undefined;
const targetValue = (value: string) =>
  value && !/^(\/(?!\/)|https?:\/\/)/i.test(value.trim())
    ? 'A path starting with "/" or a full http(s) URL'
    : undefined;

const RedirectFields: React.FC = () => (
  <>
    <TextInput
      source="source"
      label="From"
      validate={[required(), maxLength(500), sourcePath]}
      helperText="Old address including the language prefix (/uk/…); query and trailing slash are ignored"
    />
    <TextInput
      source="target"
      label="To"
      validate={[required(), maxLength(1000), targetValue]}
      helperText="A page address (/about, /uk/blog) or a full URL"
    />
    <RadioButtonGroupInput source="type" label="Type" choices={TYPE_CHOICES} />
    <BooleanInput source="enabled" label="On" />
    <TextInput
      source="note"
      label="Note"
      multiline
      validate={maxLength(500)}
      parse={(v: string) => v || null}
    />
  </>
);

const defaults = { type: 'permanent', enabled: true, note: null };

export const RedirectCreate: React.FC = () => (
  <Create redirect="list">
    <SimpleForm defaultValues={defaults}>
      <RedirectFields />
    </SimpleForm>
  </Create>
);

export const RedirectEdit: React.FC = () => (
  <Edit
    mutationMode="pessimistic"
    redirect="list"
    transform={({ source, target, type, enabled, note }) => ({
      source,
      target,
      type,
      enabled,
      note,
    })}
  >
    <SimpleForm>
      <RedirectFields />
    </SimpleForm>
  </Edit>
);
