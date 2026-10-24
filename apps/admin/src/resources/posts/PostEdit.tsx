import React from 'react';
import { DeleteButton, Edit, SaveButton, Toolbar, useRecordContext } from 'react-admin';
import type { Post } from '@tsyvinda/shared-types';
import { PostForm } from './PostForm';
import { toPostPayload, type PostFormValues } from './postPayload';

const PostEditToolbar: React.FC = () => (
  <Toolbar sx={{ justifyContent: 'space-between' }}>
    <SaveButton />
    {/* pessimistic: asks for confirmation, deletes only after the API confirms */}
    <DeleteButton mutationMode="pessimistic" confirmTitle="Delete this post?" />
  </Toolbar>
);

const PostTitle: React.FC = () => {
  const record = useRecordContext<Post>();
  return <>{record ? `Post “${record.title}”` : 'Post'}</>;
};

export const PostEdit: React.FC = () => (
  <Edit
    title={<PostTitle />}
    mutationMode="pessimistic"
    transform={(values: PostFormValues, options?: { previousData?: Post }) =>
      toPostPayload(values, options?.previousData)
    }
    sx={{ maxWidth: 1100 }}
  >
    <PostForm toolbar={<PostEditToolbar />} />
  </Edit>
);
