import React from 'react';
import { Title, useDataProvider, useGetIdentity } from 'react-admin';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { DashboardRecentUser, DashboardStats } from '@tsyvinda/shared-types';
import type { AdminDataProvider } from '../providers/dataProvider';
import { tabularNums } from '../theme';

export const DASHBOARD_QUERY_KEY = ['admin', 'dashboard'] as const;

interface Kpi {
  label: string;
  value: (stats: DashboardStats) => number;
  hint?: string;
}

const KPIS: Kpi[] = [
  { label: 'Users', value: (s) => s.users.total },
  {
    label: 'Pending approval',
    value: (s) => s.users.pendingApproval,
    hint: 'Verified, not yet approved',
  },
  { label: 'Unverified email', value: (s) => s.users.unverified },
  { label: 'New users · 7 days', value: (s) => s.users.newLast7Days },
  { label: 'New users · 30 days', value: (s) => s.users.newLast30Days },
  { label: 'Posts', value: (s) => s.posts.total },
  { label: 'New posts · 7 days', value: (s) => s.posts.newLast7Days },
  { label: 'Admins', value: (s) => s.users.admins },
];

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const KpiTile: React.FC<{ kpi: Kpi; stats?: DashboardStats }> = ({ kpi, stats }) => (
  <Card>
    <CardContent>
      <Typography variant="overline" component="p" sx={{ color: 'text.secondary' }}>
        {kpi.label}
      </Typography>
      <Typography variant="h1" component="p" sx={{ ...tabularNums, mt: 0.5 }}>
        {stats ? kpi.value(stats) : <Skeleton width={48} />}
      </Typography>
      {kpi.hint && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {kpi.hint}
        </Typography>
      )}
    </CardContent>
  </Card>
);

const UserStatus: React.FC<{ user: DashboardRecentUser }> = ({ user }) => {
  if (!user.emailVerified) return <Chip size="small" color="warning" label="Unverified" />;
  if (!user.approvedByAdmin) return <Chip size="small" color="info" label="Pending approval" />;
  return <Chip size="small" color="success" label="Approved" />;
};

const RecentUsers: React.FC<{ users: DashboardRecentUser[] }> = ({ users }) => (
  <Card>
    <CardContent sx={{ pb: 0 }}>
      <Typography variant="h4" component="h2">
        Latest signups
      </Typography>
    </CardContent>
    {users.length === 0 ? (
      <CardContent>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No users yet.
        </Typography>
      </CardContent>
    ) : (
      <TableContainer>
        <Table size="small" aria-label="Latest signups">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Signed up</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{`${user.firstName} ${user.lastName}`.trim()}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <UserStatus user={user} />
                </TableCell>
                <TableCell>{dateFormat.format(new Date(user.createdAt))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )}
  </Card>
);

export const Dashboard: React.FC = () => {
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<AdminDataProvider>();
  const { data, error, isPending } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => dataProvider.getDashboard(),
  });

  return (
    <Box sx={{ mt: 2 }}>
      <Title title="Dashboard" />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h2" sx={{ mb: 0.5 }}>
          {identity?.fullName ? `Welcome, ${identity.fullName}` : 'Welcome'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          tsyvinda.com administration.
        </Typography>
      </Box>

      {error ? (
        <Alert severity="error" role="alert">
          Could not load the dashboard: {error.message}
        </Alert>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              mb: 3,
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            }}
          >
            {KPIS.map((kpi) => (
              <KpiTile key={kpi.label} kpi={kpi} stats={data} />
            ))}
          </Box>
          {isPending ? (
            <Skeleton variant="rounded" height={240} />
          ) : (
            <RecentUsers users={data?.recentUsers ?? []} />
          )}
        </>
      )}
    </Box>
  );
};
