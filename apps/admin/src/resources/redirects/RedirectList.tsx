import React from 'react';
import {
  BooleanField,
  CreateButton,
  Datagrid,
  DeleteButton,
  EditButton,
  FunctionField,
  List,
  SearchInput,
  TextField,
  TopToolbar,
} from 'react-admin';
import { AltRoute } from '@mui/icons-material';
import { Typography } from '@mui/material';
import type { AdminRedirect } from '@tsyvinda/shared-types';
import { ListEmpty, ListNoResults } from '../../components/EmptyState';
import { listRowsPerPage } from '../../theme';

const filters = [<SearchInput key="q" source="q" alwaysOn placeholder="Search addresses" />];

const Mono: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
    {children}
  </Typography>
);

export const RedirectList: React.FC = () => (
  <List
    filters={filters}
    actions={
      <TopToolbar>
        <CreateButton />
      </TopToolbar>
    }
    perPage={listRowsPerPage}
    exporter={false}
    empty={
      <ListEmpty
        icon={AltRoute}
        subtitle="Send visitors from an address the website no longer has to a page or URL. Changed page addresses redirect on their own."
      />
    }
  >
    <Datagrid rowClick="edit" bulkActionButtons={false} empty={<ListNoResults />}>
      <FunctionField<AdminRedirect> label="From" render={(row) => <Mono>{row.source}</Mono>} />
      <FunctionField<AdminRedirect> label="To" render={(row) => <Mono>{row.target}</Mono>} />
      <FunctionField<AdminRedirect>
        label="Type"
        render={(row) => (row.type === 'permanent' ? '308 permanent' : '307 temporary')}
      />
      <BooleanField source="enabled" label="On" />
      <TextField source="note" label="Note" emptyText="—" />
      <EditButton />
      <DeleteButton mutationMode="pessimistic" confirmTitle="Delete this redirect?" />
    </Datagrid>
  </List>
);
