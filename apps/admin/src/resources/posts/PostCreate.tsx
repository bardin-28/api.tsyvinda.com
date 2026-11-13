import React from 'react';
import { Create } from 'react-admin';
import { PostForm } from './PostForm';
import { toPostPayload, type PostFormValues } from './postPayload';
import { PublishCard, SettingsCard } from './PostSidebar';

/** New posts start as drafts with no categories; author empty = the signed-in admin. */
const NEW_POST_DEFAULTS = { status: 'draft', categoryIds: [] };

export const PostCreate: React.FC = () => (
  <Create
    redirect="edit"
    transform={(values: PostFormValues) => toPostPayload(values)}
    // No Card wrapper: it would clip the sticky sidebar
    component="div"
  >
    <PostForm
      autoSlug
      defaultValues={NEW_POST_DEFAULTS}
      sidebar={
        <>
          <PublishCard />
          <SettingsCard />
        </>
      }
    />
  </Create>
);
