import React from 'react';
import {
  AutocompleteArrayInput,
  AutocompleteInput,
  DateTimeInput,
  DeleteButton,
  ReferenceArrayInput,
  ReferenceInput,
  SaveButton,
  useRecordContext,
} from 'react-admin';
import { Box, Typography } from '@mui/material';
import { PublicOff, Public } from '@mui/icons-material';
import type { AdminPost, PostStatus, User } from '@tsyvinda/shared-types';
import { SidebarCard } from '../../components/DetailLayout';
import { PostStatusChip } from '../../components/PostStatusChip';
import { toPostPayload, type PostFormValues } from './postPayload';

/** Builds a Save button's transform that sends the form with a fixed status. */
const withStatus =
  (status: PostStatus) => (values: PostFormValues, options?: { previousData?: AdminPost }) =>
    toPostPayload({ ...values, status }, options?.previousData);

/**
 * Publish box, the post's only actions block: drafts get "Save draft" + "Publish", published
 * posts "Publish changes" + "Unpublish"; Publish/Unpublish work even without other edits.
 * Existing posts also get Delete (with a confirmation dialog) at the bottom.
 */
export const PublishCard: React.FC = () => {
  const post = useRecordContext<AdminPost>();
  const status: PostStatus = post?.status ?? 'draft';
  const isPublished = status === 'published';

  return (
    <SidebarCard title="Publish">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2">Status:</Typography>
        <PostStatusChip status={status} />
      </Box>
      {isPublished ? (
        <>
          <SaveButton
            fullWidth
            color="success"
            label="Publish changes"
            icon={<Public />}
            // A per-button transform requires type="button" (not the form's submit)
            type="button"
            transform={withStatus('published')}
          />
          <SaveButton
            fullWidth
            variant="outlined"
            color="inherit"
            label="Unpublish"
            icon={<PublicOff />}
            alwaysEnable
            type="button"
            transform={withStatus('draft')}
          />
        </>
      ) : (
        <>
          <SaveButton
            fullWidth
            variant="outlined"
            color="inherit"
            label="Save draft"
            type="button"
            transform={withStatus('draft')}
          />
          <SaveButton
            fullWidth
            color="success"
            label="Publish"
            icon={<Public />}
            alwaysEnable
            type="button"
            transform={withStatus('published')}
          />
        </>
      )}
      {post && (
        // pessimistic: asks for confirmation, deletes only after the API confirms
        <DeleteButton
          fullWidth
          mutationMode="pessimistic"
          label="Delete post"
          confirmTitle="Delete this post?"
          confirmContent="The post, its cover and social image are removed. This cannot be undone."
        />
      )}
    </SidebarCard>
  );
};

const userName = (user: Pick<User, 'firstName' | 'lastName' | 'email'>) =>
  `${user.firstName} ${user.lastName}`.trim() || user.email;

/** Settings box: categories (ordered, first = main), author (empty = you), date shown. */
export const SettingsCard: React.FC = () => (
  <SidebarCard title="Settings">
    <ReferenceArrayInput
      source="categoryIds"
      reference="categories"
      sort={{ field: 'name', order: 'ASC' }}
      perPage={100}
    >
      <AutocompleteArrayInput
        label="Categories"
        optionText="name"
        filterToQuery={(q: string) => ({ q })}
        helperText={false}
      />
    </ReferenceArrayInput>
    <ReferenceInput source="authorId" reference="users" sort={{ field: 'firstName', order: 'ASC' }}>
      <AutocompleteInput
        label="Author"
        optionText={userName}
        filterToQuery={(q: string) => ({ q })}
        helperText={false}
      />
    </ReferenceInput>
    <DateTimeInput source="publishedAt" label="Date shown" helperText={false} />
  </SidebarCard>
);
