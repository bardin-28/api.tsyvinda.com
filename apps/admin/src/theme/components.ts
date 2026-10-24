import type { Theme } from '@mui/material/styles';
import type { RaThemeOptions } from 'react-admin';
import {
  brand,
  dropdownMaxHeight,
  EMPTY_CELL,
  duration,
  neutral,
  radius,
  rowHeight,
  tableMaxHeight,
  tabularNums,
} from './tokens';

type Mode = 'light' | 'dark';

/**
 * Shared component overrides for both palettes. Borders carry separation
 * instead of drop shadows — flatter reads as more precise for data tools.
 */
export const buildComponents = (mode: Mode): RaThemeOptions['components'] => {
  const isLight = mode === 'light';

  const border = isLight ? neutral[200] : neutral[800];
  const surface = isLight ? '#FFFFFF' : neutral[900];
  // Recessed against `paper` so fields stay legible as inputs on dark ground
  const inputSurface = isLight ? '#FFFFFF' : neutral[950];
  const subtleSurface = isLight ? neutral[50] : neutral[800];
  const hoverSurface = isLight ? neutral[50] : 'rgba(135, 146, 162, 0.10)';
  // 400 on the dark header ground lands at 4.38:1 — below AA for the
  // 12px uppercase header text, so dark steps up to 300.
  const headerText = isLight ? neutral[600] : neutral[300];
  const focusRing = isLight ? brand[500] : brand[400];

  return {
    // A blank cell is ambiguous — it reads as a rendering fault rather than an
    // absent value. Set once here so every table and show view agrees, instead
    // of repeating `emptyText` on hundreds of field instances. FunctionField is
    // absent on purpose: it renders whatever its `render` returns.
    RaTextField: { defaultProps: { emptyText: EMPTY_CELL } },
    RaNumberField: { defaultProps: { emptyText: EMPTY_CELL } },
    RaSelectField: { defaultProps: { emptyText: EMPTY_CELL } },
    RaReferenceField: { defaultProps: { emptyText: EMPTY_CELL } },
    RaBooleanField: { defaultProps: { emptyText: EMPTY_CELL } },
    RaEmailField: { defaultProps: { emptyText: EMPTY_CELL } },
    RaUrlField: { defaultProps: { emptyText: EMPTY_CELL } },
    RaChipField: { defaultProps: { emptyText: EMPTY_CELL } },

    MuiCssBaseline: {
      styleOverrides: {
        // Keyboard focus was previously invisible on most controls
        '*:focus-visible': {
          outline: `2px solid ${focusRing}`,
          outlineOffset: 2,
        },
        '::selection': {
          backgroundColor: isLight ? brand[100] : brand[800],
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        variant: 'outlined' as const,
        margin: 'dense' as const,
        size: 'small' as const,
        fullWidth: true,
      },
    },
    MuiFormControl: {
      defaultProps: {
        variant: 'outlined' as const,
        margin: 'dense' as const,
        size: 'small' as const,
        fullWidth: true,
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: '0.875rem' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.sm,
          backgroundColor: inputSurface,
          transition: `border-color ${duration.fast}ms ease, box-shadow ${duration.fast}ms ease`,
        },
        notchedOutline: { borderColor: border },
        // MUI ships its own `-webkit-autofill` box-shadow on this slot, and its
        // `.css-x:-webkit-autofill` selector outranks a bare
        // `input:-webkit-autofill` from CssBaseline — so the override has to
        // live here to win. Chrome ignores `background-color` when autofilled,
        // hence the inset shadow.
        input: {
          '&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus, &:-webkit-autofill:active':
            {
              WebkitBoxShadow: `0 0 0 100px ${inputSurface} inset`,
              WebkitTextFillColor: isLight ? neutral[900] : neutral[100],
              caretColor: isLight ? neutral[900] : neutral[100],
              borderRadius: 'inherit',
            },
        },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none' as const,
          fontWeight: 600,
          borderRadius: radius.sm,
          transition: `background-color ${duration.fast}ms ease, border-color ${duration.fast}ms ease`,
        },
        sizeSmall: { paddingInline: 12 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: radius.sm },
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: border },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0, variant: 'outlined' as const },
      styleOverrides: {
        root: { borderRadius: radius.md, borderColor: border },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: border } },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: border,
          fontSize: '0.8125rem',
          paddingBlock: 6,
          ...tabularNums,
          '&.MuiTableCell-paddingCheckbox': { padding: '0 8px' },
        },
        head: {
          fontWeight: 600,
          fontSize: '0.75rem',
          letterSpacing: '0.02em',
          textTransform: 'uppercase' as const,
          color: headerText,
          backgroundColor: subtleSurface,
          whiteSpace: 'nowrap' as const,
        },
        // Sticky headers default to the page background; keep the header tint
        stickyHeader: { backgroundColor: subtleSurface },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: { maxHeight: tableMaxHeight, overflow: 'auto' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          height: rowHeight,
          transition: `background-color ${duration.fast}ms ease`,
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radius.sm, fontWeight: 600 },
        sizeSmall: { height: 22, fontSize: '0.6875rem' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.75rem',
          borderRadius: radius.sm,
          backgroundColor: isLight ? neutral[800] : neutral[700],
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: radius.sm, fontSize: '0.8125rem' },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        listbox: { maxHeight: dropdownMaxHeight },
        // Papers default to elevation 0 here; Select menus pass 8, so match them
        paper: ({ theme }: { theme: Theme }) => ({
          boxShadow: theme.shadows[8],
        }),
      },
    },
    // Select inputs open their options in a Menu
    MuiMenu: {
      styleOverrides: { paper: { maxHeight: dropdownMaxHeight } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: radius.lg, border: `1px solid ${border}` },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontSize: '1.0625rem', fontWeight: 600 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none' as const, fontWeight: 600 },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: { borderRadius: radius.sm },
      },
    },

    RaDatagrid: {
      styleOverrides: {
        root: {
          '& .RaDatagrid-headerCell': {
            backgroundColor: subtleSurface,
            borderBottom: `1px solid ${border}`,
          },
          '& .RaDatagrid-rowCell': { color: 'inherit' },
          '& .RaDatagrid-row:hover': { backgroundColor: hoverSurface },
          // Long or wide lists scroll inside the table (RA keeps the header sticky)
          '& .RaDatagrid-tableWrapper': {
            maxHeight: tableMaxHeight,
            overflow: 'auto',
          },
        },
      },
    },
    RaList: {
      styleOverrides: {
        root: { minWidth: 0, '& .RaList-main': { minWidth: 0 } },
      },
    },
    RaAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: surface,
          color: isLight ? neutral[900] : neutral[100],
          borderBottom: `1px solid ${border}`,
          boxShadow: 'none',
        },
      },
    },
    // `<Layout sidebar>` substitutes RA's <Sidebar> entirely, so RaSidebar
    // never mounts here — CustomSidebar owns the rail's border and surface.
    // RaMenu is what reads theme.sidebar.width / closedWidth.
    RaMenu: {
      styleOverrides: {
        root: { paddingTop: 8 },
      },
    },
    RaLayout: {
      styleOverrides: {
        root: {
          // RA's fit-content lets a wide table push the whole page sideways
          minWidth: 0,
          '& .RaLayout-appFrame, & .RaLayout-contentWithSidebar': {
            minWidth: 0,
          },
          '& .RaLayout-content': {
            padding: 24,
            backgroundColor: 'transparent',
            minWidth: 0,
          },
        },
      },
    },
    RaMenuItemLink: {
      styleOverrides: {
        root: {
          borderRadius: radius.sm,
          marginInline: 8,
          transition: `background-color ${duration.fast}ms ease, color ${duration.fast}ms ease`,
          // Icons carry their own colour, so `inherit` is what lets the brand tint
          // below reach them — tinting only the label leaves the rail half-lit.
          '& .RaMenuItemLink-icon': {
            color: isLight ? neutral[500] : neutral[400],
            transition: `color ${duration.fast}ms ease`,
          },
          '&:hover': {
            color: isLight ? brand[600] : brand[300],
            backgroundColor: isLight ? brand[50] : 'rgba(139, 133, 255, 0.08)',
            '& .RaMenuItemLink-icon': { color: 'inherit' },
          },
          '&.RaMenuItemLink-active': {
            fontWeight: 600,
            color: isLight ? brand[600] : brand[300],
            backgroundColor: isLight ? brand[50] : 'rgba(139, 133, 255, 0.12)',
            '& .RaMenuItemLink-icon': { color: 'inherit' },
          },
        },
      },
    },
    // RA aligns the filter form and the action buttons to `flex-end`, which
    // leaves them on different baselines. Both are centred instead.
    RaListToolbar: {
      styleOverrides: {
        root: {
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          minHeight: 48,
        },
      },
    },
    RaTopToolbar: {
      styleOverrides: {
        root: {
          alignItems: 'center',
          paddingTop: 0,
          paddingBottom: 0,
          minHeight: 40,
        },
      },
    },
    RaFilterForm: {
      styleOverrides: {
        root: {
          alignItems: 'center',
          marginTop: 0,
          marginBottom: 0,
          paddingBottom: 0,
          minHeight: 40,
          // The explicit minHeight drops flex's min-content floor: on phones the stacked toolbar squashed wrapped filters
          flexShrink: 0,
          // RA sets minHeight: spacing(8) behind this breakpoint, so matching
          // the media query is what actually overrides it.
          '@media (min-width: 600px)': { minHeight: 40 },
          // The 8px top margin pairs with RA's flex-end baseline; centred
          // alignment has to drop it or inputs sit low in the row.
          '& .RaFilterForm-filterFormInput .MuiFormControl-root': {
            marginTop: 0,
          },
        },
      },
    },
    RaFilterFormInput: {
      styleOverrides: {
        root: {
          alignItems: 'center',
          marginBottom: 0,
          // Same flex-end offset on the remove button
          '& .RaFilterFormInput-hideButton': { marginBottom: 0 },
        },
      },
    },
    RaToolbar: {
      styleOverrides: {
        root: {
          backgroundColor: subtleSurface,
          borderTop: `1px solid ${border}`,
        },
      },
    },
    RaBulkActionsToolbar: {
      styleOverrides: {
        root: { borderRadius: radius.sm },
      },
    },
    RaEmpty: {
      styleOverrides: {
        root: {
          paddingBlock: 56,
          '& .RaEmpty-message': { color: headerText },
          '& .RaEmpty-icon': { width: 56, height: 56, opacity: 0.5 },
        },
      },
    },
  };
};
