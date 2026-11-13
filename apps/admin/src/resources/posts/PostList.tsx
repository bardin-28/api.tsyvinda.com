import React from 'react';
import {
  CreateButton,
  Datagrid,
  EditButton,
  FunctionField,
  List,
  ReferenceInput,
  SearchInput,
  SelectInput,
  TopToolbar,
} from 'react-admin';
import { Article } from '@mui/icons-material';
import type { AdminPost } from '@tsyvinda/shared-types';
import { TruncatedText, TruncatedTextField } from '../../components/TruncatedText';
import { ListEmpty, ListNoResults } from '../../components/EmptyState';
import { PostStatusChip } from '../../components/PostStatusChip';
import { formatDate, formatDateTime } from '../../lib/dateFormat';
import { EMPTY_CELL, listRowsPerPage } from '../../theme';
import { LocaleChips } from '../../components/Translations';

const STATUS_CHOICES = [
  { id: 'published', name: 'Published' },
  { id: 'draft', name: 'Draft' },
];

const filters = [
  <SearchInput key="q" source="q" alwaysOn placeholder="Search" />,
  <ReferenceInput
    key="categoryId"
    source="categoryId"
    reference="categories"
    sort={{ field: 'name', order: 'ASC' }}
    perPage={100}
    alwaysOn
  >
    <SelectInput label="Category" optionText="name" />
  </ReferenceInput>,
  <SelectInput key="status" source="status" label="Status" choices={STATUS_CHOICES} alwaysOn />,
];

const ListActions: React.FC = () => (
  <TopToolbar>
    <CreateButton />
  </TopToolbar>
);

export const PostList: React.FC = () => (
  <List
    filters={filters}
    actions={<ListActions />}
    sort={{ field: 'updatedAt', order: 'DESC' }}
    perPage={listRowsPerPage}
    empty={
      <ListEmpty
        icon={Article}
        subtitle="Articles you write appear here and on the website blog."
      />
    }
  >
    <Datagrid rowClick="edit" empty={<ListNoResults />}>
      <TruncatedTextField source="title" label="Title" />
      <FunctionField<AdminPost>
        label="Languages"
        sortable={false}
        render={(post) => <LocaleChips locales={post.locales} />}
      />
      <FunctionField<AdminPost>
        label="Categories"
        sortable={false}
        render={(post) => (
          <TruncatedText
            text={post.categories.map((category) => category.name).join(', ') || null}
            maxWidth={220}
          />
        )}
      />
      <FunctionField<AdminPost>
        label="Author"
        sortable={false}
        render={(post) => (
          <TruncatedText
            text={`${post.author.firstName} ${post.author.lastName}`.trim()}
            maxWidth={180}
          />
        )}
      />
      <FunctionField<AdminPost>
        label="Status"
        source="status"
        render={(post) => <PostStatusChip status={post.status} />}
      />
      <FunctionField<AdminPost>
        label="Date"
        source="publishedAt"
        render={(post) => formatDate(post.publishedAt) || EMPTY_CELL}
      />
      <FunctionField<AdminPost>
        label="Updated at"
        source="updatedAt"
        render={(post) => formatDateTime(post.updatedAt)}
      />
      <EditButton />
    </Datagrid>
  </List>
);
