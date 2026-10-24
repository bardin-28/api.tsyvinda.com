import React from 'react';
import {
  CreateButton,
  Datagrid,
  DateField,
  FunctionField,
  List,
  SearchInput,
  TextField,
  TopToolbar,
} from 'react-admin';
import { Avatar } from '@mui/material';
import { Article } from '@mui/icons-material';
import type { Post } from '@tsyvinda/shared-types';

const filters = [<SearchInput key="q" source="q" alwaysOn placeholder="Search title or slug" />];

const ListActions: React.FC = () => (
  <TopToolbar>
    <CreateButton />
  </TopToolbar>
);

export const PostList: React.FC = () => (
  <List
    filters={filters}
    actions={<ListActions />}
    sort={{ field: 'createdAt', order: 'DESC' }}
    perPage={25}
  >
    <Datagrid rowClick="edit">
      <FunctionField<Post>
        label="Cover"
        sortable={false}
        render={(post) => (
          <Avatar
            variant="rounded"
            src={post.imageUrl ?? undefined}
            alt=""
            sx={{ width: 48, height: 32 }}
          >
            <Article fontSize="small" />
          </Avatar>
        )}
      />
      <TextField source="title" />
      <TextField source="slug" />
      <FunctionField<Post>
        label="Author"
        sortable={false}
        render={(post) => `${post.author.firstName} ${post.author.lastName}`.trim()}
      />
      <DateField source="createdAt" label="Created" showTime />
      <DateField source="updatedAt" label="Updated" showTime />
    </Datagrid>
  </List>
);
