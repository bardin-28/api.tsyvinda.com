import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, ResourceMenuItem, usePermissions, useSidebarState } from 'react-admin';
import { Dashboard } from '@mui/icons-material';
import { Box, Divider } from '@mui/material';
import type { Role } from '@tsyvinda/shared-types';
import {
  ADMIN_CUSTOM_PAGES,
  ADMIN_MENU_GROUPS,
  ADMIN_RESOURCES,
  type AdminCustomPageConfig,
  type AdminMenuGroupId,
} from '../resources/resources.config';
import { isVisibleToRole } from '../accessControl';
import { SidebarMenuGroup } from './SidebarMenuGroup';

const isPathInside = (pathname: string, path: string): boolean =>
  pathname === path || pathname.startsWith(`${path}/`);

/** The group whose items contain the current route, if any. */
export function findActiveGroup(
  groups: { id: AdminMenuGroupId; paths: string[] }[],
  pathname: string,
): AdminMenuGroupId | null {
  return (
    groups.find((group) => group.paths.some((path) => isPathInside(pathname, path)))?.id ?? null
  );
}

export const CustomSidebar: React.FC = () => {
  const { permissions } = usePermissions<Role>();
  const [open] = useSidebarState();
  const { pathname } = useLocation();

  const visibleResources = ADMIN_RESOURCES.filter((resource) =>
    isVisibleToRole(resource.roles, permissions),
  );
  const ungroupedResources = visibleResources.filter((resource) => !resource.group);
  const visiblePages = ADMIN_CUSTOM_PAGES.filter((page) =>
    isVisibleToRole(page.roles, permissions),
  );

  // Groups the role may see, with their items' routes
  const groups = ADMIN_MENU_GROUPS.map((group) => {
    const resources = visibleResources.filter((resource) => resource.group === group.id);
    const pages = visiblePages.filter((page) => page.group === group.id);
    return {
      ...group,
      resources,
      pages,
      paths: [
        ...resources.map((resource) => `/${resource.name}`),
        ...pages.map((page) => page.path),
      ],
    };
  }).filter((group) => group.paths.length > 0);

  const activeGroupId = findActiveGroup(groups, pathname);
  // Accordion: at most one group open; opening one closes the others.
  const [openGroupId, setOpenGroupId] = useState<AdminMenuGroupId | null>(activeGroupId);

  // Navigating into a group (e.g. from the dashboard) opens it and closes the rest.
  useEffect(() => {
    if (activeGroupId) setOpenGroupId(activeGroupId);
  }, [activeGroupId]);

  const renderPageItem = (page: AdminCustomPageConfig) => {
    const PageIcon = page.icon;
    return (
      <Menu.Item key={page.path} to={page.path} primaryText={page.label} leftIcon={<PageIcon />} />
    );
  };

  const renderGroup = (group: (typeof groups)[number]) => (
    <SidebarMenuGroup
      key={group.id}
      label={group.label}
      icon={group.icon}
      expanded={openGroupId === group.id}
      active={activeGroupId === group.id}
      onToggle={() => setOpenGroupId((current) => (current === group.id ? null : group.id))}
    >
      {group.resources.map((resource) => (
        <ResourceMenuItem key={resource.name} name={resource.name} />
      ))}
      {group.pages.map(renderPageItem)}
    </SidebarMenuGroup>
  );
  const bottomGroups = groups.filter((group) => group.pinBottom);

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
        {groups.filter((group) => !group.pinBottom).map(renderGroup)}
        {ungroupedResources.map((resource) => (
          <ResourceMenuItem key={resource.name} name={resource.name} />
        ))}
        {visiblePages.filter((page) => !page.group).map(renderPageItem)}
        {/* Bottom section (e.g. Settings): last in the menu, after a divider */}
        {bottomGroups.length > 0 && <Divider sx={{ my: 1 }} />}
        {bottomGroups.map(renderGroup)}
      </Menu>
    </Box>
  );
};
