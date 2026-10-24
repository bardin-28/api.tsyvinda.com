import React from 'react';
import { Menu, ResourceMenuItem, usePermissions, useSidebarState } from 'react-admin';
import { Dashboard } from '@mui/icons-material';
import { Box } from '@mui/material';
import type { Role } from '@tsyvinda/shared-types';
import { ADMIN_RESOURCES } from '../resources/resources.config';
import { isVisibleToRole } from '../accessControl';

export const CustomSidebar: React.FC = () => {
  const { permissions } = usePermissions<Role>();
  const [open] = useSidebarState();

  return (
    <Box
      sx={{
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        flexShrink: 0,
        '& .RaMenuItemLink-root': { paddingInline: 0 },
        '& .RaMenuItemLink-icon': { minWidth: 40, justifyContent: 'center' },
        // Hiding the label cannot move the icon, which precedes it in a fixed box
        ...(open ? {} : { '& .RaMenuItemLink-root .MuiTypography-root': { display: 'none' } }),
      }}
    >
      <Menu>
        <Menu.Item to="/" primaryText="Dashboard" leftIcon={<Dashboard />} />
        {ADMIN_RESOURCES.filter((resource) => isVisibleToRole(resource.roles, permissions)).map(
          (resource) => (
            <ResourceMenuItem key={resource.name} name={resource.name} />
          ),
        )}
      </Menu>
    </Box>
  );
};
