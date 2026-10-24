import React from 'react';
import { Create } from 'react-admin';
import { PostForm } from './PostForm';
import { toPostPayload, type PostFormValues } from './postPayload';

export const PostCreate: React.FC = () => (
  <Create
    redirect="edit"
    transform={(values: PostFormValues) => toPostPayload(values)}
    sx={{ maxWidth: 1100 }}
  >
    <PostForm autoSlug />
  </Create>
);
