import React, { useId } from 'react';
import { useSidebarState } from 'react-admin';
import type { SvgIconComponent } from '@mui/icons-material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { Box, Collapse, ListItemIcon, ListItemText, MenuItem } from '@mui/material';
import { brand, duration, radius } from '../theme';

interface SidebarMenuGroupProps {
  label: string;
  icon: SvgIconComponent;
  /** Controlled by CustomSidebar, which keeps at most one group open */
  expanded: boolean;
  onToggle: () => void;
  /** The current route is one of this group's items (highlights the header) */
  active: boolean;
  children: React.ReactNode;
}

/**
 * Collapsible sidebar section. Reuses the RaMenuItemLink class names so CustomSidebar's
 * icon alignment and closed-rail label hiding apply to the header too.
 */
export const SidebarMenuGroup: React.FC<SidebarMenuGroupProps> = ({
  label,
  icon: Icon,
  expanded,
  onToggle,
  active,
  children,
}) => {
  const [sidebarOpen] = useSidebarState();
  const itemsId = useId();
  const ExpandIcon = expanded ? ExpandLess : ExpandMore;

  return (
    <>
      <MenuItem
        className="RaMenuItemLink-root"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={itemsId}
        sx={(theme) => ({
          borderRadius: `${radius.sm}px`,
          marginInline: 1,
          // Same exact brand orange as an active RaMenuItemLink
          color: active ? brand[500] : 'text.secondary',
          fontWeight: active ? 600 : undefined,
          transition: `color ${duration.fast}ms ease, background-color ${duration.fast}ms ease`,
          '& .RaMenuItemLink-icon': { color: 'inherit' },
          '&:hover': { backgroundColor: theme.palette.action.hover },
        })}
      >
        <ListItemIcon className="RaMenuItemLink-icon">
          {/* Default size, same as RA menu item icons (Dashboard, Articles…) */}
          <Icon />
        </ListItemIcon>
        {/* Keep the Typography wrapper: CustomSidebar hides `.MuiTypography-root` on the closed rail */}
        <ListItemText
          primary={label}
          slotProps={{ primary: { sx: { fontSize: '0.875rem', fontWeight: 'inherit' } } }}
        />
        {sidebarOpen && <ExpandIcon fontSize="small" sx={{ mr: 1 }} />}
      </MenuItem>
      <Collapse in={expanded} timeout={duration.base} unmountOnExit>
        {/* Indent only on the open rail; the closed rail is icons-only and fixed-width */}
        <Box id={itemsId} sx={{ pl: sidebarOpen ? 2 : 0 }}>
          {children}
        </Box>
      </Collapse>
    </>
  );
};
