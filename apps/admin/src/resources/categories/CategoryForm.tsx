import React, { useEffect } from 'react';
import {
  Create,
  DeleteButton,
  Edit,
  Form,
  TextInput,
  maxLength,
  required,
  useRecordContext,
} from 'react-admin';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AdminPostCategory } from '@tsyvinda/shared-types';
import { DetailLayout, SaveCard, SidebarCard, SidebarFacts } from '../../components/DetailLayout';
import { formatDate } from '../../lib/dateFormat';
import { slugify } from '../posts/slugify';
import { slugFormat } from '../posts/PostForm';
import { MissingTranslationNotice, UnsavedChangesReporter } from '../../components/Translations';
import { LOCALE_LABELS, useContentLocale } from '../../lib/contentLocale';

/** On create, the key follows the name until it is edited by hand. */
const SlugFromName: React.FC = () => {
  const name = useWatch({ name: 'name' }) as string | undefined;
  const { setValue, getFieldState } = useFormContext();
  useEffect(() => {
    if (!getFieldState('slug').isDirty) {
      setValue('slug', slugify(name ?? '').slice(0, 100), { shouldValidate: !!name });
    }
  }, [name, setValue, getFieldState]);
  return null;
};

const CategoryFields: React.FC = () => {
  const locale = useContentLocale();
  return (
    <>
      <UnsavedChangesReporter />
      <MissingTranslationNotice what="category" fields="the name" />
      <TextInput
        source="name"
        validate={[required(), maxLength(100)]}
        helperText={`Name in ${LOCALE_LABELS[locale].name}`}
      />
      <TextInput
        source="slug"
        label="Filter key"
        validate={[required(), maxLength(100), slugFormat]}
        helperText="Shared by all languages. Used in website URLs: /blog?category=<key>"
      />
    </>
  );
};

const CategoryEditSidebar: React.FC = () => {
  const category = useRecordContext<AdminPostCategory>();
  if (!category) return null;
  return (
    <>
      <SaveCard note="Renames show on the website right away." />
      <SidebarCard title="Details">
        <SidebarFacts
          facts={[
            ['Posts', category.postCount],
            ['Created', formatDate(category.createdAt)],
          ]}
        />
      </SidebarCard>
      <SidebarCard title="Delete" centered>
        <DeleteButton
          mutationMode="pessimistic"
          label="Delete category"
          confirmTitle="Delete this category?"
          confirmContent="Posts keep existing; they are only removed from this category."
        />
      </SidebarCard>
    </>
  );
};

const CategoryTitle: React.FC = () => {
  const category = useRecordContext<AdminPostCategory>();
  return <>{category?.name ? `Category “${category.name}”` : 'Category'}</>;
};

export const CategoryEdit: React.FC = () => (
  <Edit
    title={<CategoryTitle />}
    actions={false}
    component="div"
    mutationMode="pessimistic"
    transform={(values: AdminPostCategory) => ({ name: values.name, slug: values.slug })}
  >
    <Form>
      <DetailLayout sidebar={<CategoryEditSidebar />}>
        <CategoryFields />
      </DetailLayout>
    </Form>
  </Edit>
);

export const CategoryCreate: React.FC = () => (
  <Create redirect="list" component="div">
    <Form>
      <SlugFromName />
      <DetailLayout sidebar={<SaveCard label="Create category" note="Pick it on any post next." />}>
        <CategoryFields />
      </DetailLayout>
    </Form>
  </Create>
);
