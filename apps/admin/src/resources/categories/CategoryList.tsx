import React from 'react';
import {
  CreateButton,
  Datagrid,
  DeleteButton,
  EditButton,
  FunctionField,
  List,
  NumberField,
  SearchInput,
  TopToolbar,
} from 'react-admin';
import { Category } from '@mui/icons-material';
import { TruncatedTextField } from '../../components/TruncatedText';
import { ListEmpty, ListNoResults } from '../../components/EmptyState';
import { listRowsPerPage } from '../../theme';
import { LocaleChips } from '../../components/Translations';
import type { AdminPostCategory } from '@tsyvinda/shared-types';

const filters = [<SearchInput key="q" source="q" alwaysOn placeholder="Search name or key" />];

const ListActions: React.FC = () => (
  <TopToolbar>
    <CreateButton />
  </TopToolbar>
);

export const CategoryList: React.FC = () => (
  <List
    filters={filters}
    actions={<ListActions />}
    sort={{ field: 'name', order: 'ASC' }}
    perPage={listRowsPerPage}
    empty={
      <ListEmpty
        icon={Category}
        subtitle="Group posts by topic; the website shows them as filters on the blog."
      />
    }
  >
    <Datagrid rowClick="edit" bulkActionButtons={false} empty={<ListNoResults />}>
      <TruncatedTextField source="name" label="Name" />
      <FunctionField<AdminPostCategory>
        label="Languages"
        sortable={false}
        render={(category) => <LocaleChips locales={category.locales} />}
      />
      <TruncatedTextField source="slug" label="Filter key" />
      <NumberField source="postCount" label="Posts" sortable={false} />
      <EditButton />
      <DeleteButton
        mutationMode="pessimistic"
        confirmTitle="Delete this category?"
        confirmContent="Posts keep existing; they are only removed from this category."
      />
    </Datagrid>
  </List>
);
