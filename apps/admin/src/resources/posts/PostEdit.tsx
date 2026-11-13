import React from 'react';
import { Edit, useRecordContext } from 'react-admin';
import type { AdminPost } from '@tsyvinda/shared-types';
import { PostForm } from './PostForm';
import { toPostPayload, type PostFormValues } from './postPayload';
import { PublishCard, SettingsCard } from './PostSidebar';
import { TranslationsCard } from '../../components/Translations';

const PostTitle: React.FC = () => {
  const record = useRecordContext<AdminPost>();
  return <>{record?.title ? `Post “${record.title}”` : 'Post'}</>;
};

export const PostEdit: React.FC = () => (
  <Edit
    title={<PostTitle />}
    // Actions live in the sticky sidebar; no Card wrapper (it would clip the sticky column)
    actions={false}
    component="div"
    mutationMode="pessimistic"
    // Stay on the page after saving (status and "last saved" update in place)
    redirect={false}
    transform={(values: PostFormValues, options?: { previousData?: AdminPost }) =>
      toPostPayload(values, options?.previousData)
    }
  >
    <PostForm
      sidebar={
        <>
          <PublishCard />
          <TranslationsCard />
          <SettingsCard />
        </>
      }
    />
  </Edit>
);
