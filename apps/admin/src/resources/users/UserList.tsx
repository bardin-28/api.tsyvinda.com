import React from 'react';
import {
  Datagrid,
  DateField,
  FunctionField,
  List,
  NumberField,
  SearchInput,
  SelectInput,
} from 'react-admin';
import { Chip } from '@mui/material';
import { People } from '@mui/icons-material';
import type { AdminUser } from '@tsyvinda/shared-types';
import { TruncatedText, TruncatedTextField } from '../../components/TruncatedText';
import { ListEmpty, ListNoResults } from '../../components/EmptyState';
import { listRowsPerPage } from '../../theme';
import { ROLE_CHOICES, fullName } from './userDisplay';

const filters = [
  <SearchInput key="q" source="q" alwaysOn placeholder="Search name or email" />,
  <SelectInput key="role" source="role" label="Role" choices={ROLE_CHOICES} alwaysOn />,
];

export const UserList: React.FC = () => (
  <List
    filters={filters}
    // No create: accounts come from sign-up on the website
    actions={false}
    sort={{ field: 'createdAt', order: 'DESC' }}
    perPage={listRowsPerPage}
    empty={
      <ListEmpty
        noun="users"
        icon={People}
        subtitle="People who sign up on the website appear here."
      />
    }
  >
    {/* Bulk delete would fail row by row on users with posts; delete from the edit page */}
    <Datagrid rowClick="edit" bulkActionButtons={false} empty={<ListNoResults noun="users" />}>
      <FunctionField<AdminUser>
        label="Name"
        source="firstName"
        render={(user) => <TruncatedText text={fullName(user)} />}
      />
      <TruncatedTextField source="email" label="Email" />
      <FunctionField<AdminUser>
        label="Role"
        source="role"
        render={(user) => (
          <Chip
            size="small"
            label={user.role === 'ADMIN' ? 'Admin' : 'User'}
            color={user.role === 'ADMIN' ? 'primary' : 'default'}
            variant={user.role === 'ADMIN' ? 'filled' : 'outlined'}
          />
        )}
      />
      <NumberField source="postCount" label="Posts" sortable={false} />
      <DateField source="createdAt" label="Signed up" showTime />
    </Datagrid>
  </List>
);
