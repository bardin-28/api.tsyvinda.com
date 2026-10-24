import React from 'react';
import { Admin, Resource } from 'react-admin';
import type { Role } from '@tsyvinda/shared-types';
import { authProvider } from './auth/authProvider';
import { dataProvider } from './providers/dataProvider';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { CustomLayout } from './layout/CustomLayout';
import { darkTheme, lightTheme } from './theme';
import { ADMIN_RESOURCES } from './resources/resources.config';
import { isVisibleToRole } from './accessControl';

export const App: React.FC = () => (
  <Admin
    authProvider={authProvider}
    dataProvider={dataProvider}
    loginPage={LoginPage}
    dashboard={Dashboard}
    layout={CustomLayout}
    theme={lightTheme}
    darkTheme={darkTheme}
    defaultTheme="light"
    title="tsyvinda.com Admin"
    requireAuth
  >
    {(permissions) =>
      ADMIN_RESOURCES.filter((resource) =>
        isVisibleToRole(resource.roles, permissions as Role | undefined),
      ).map((resource) => (
        <Resource
          key={resource.name}
          name={resource.name}
          icon={resource.icon}
          options={resource.label ? { label: resource.label } : undefined}
          list={resource.list}
          show={resource.show}
          edit={resource.edit}
          create={resource.create}
        />
      ))
    }
  </Admin>
);
