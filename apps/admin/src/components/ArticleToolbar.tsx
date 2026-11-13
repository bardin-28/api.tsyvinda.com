import React, { useEffect, useReducer, useState } from 'react';
import { useTiptapEditor } from 'ra-input-rich-text';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Code,
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  FormatUnderlined,
  HorizontalRule,
  Image as ImageIcon,
  Link as LinkIcon,
  Redo,
  Undo,
} from '@mui/icons-material';

/** TipTap editor type, taken from ra-input-rich-text (tiptap is not a direct dependency). */
type Editor = ReturnType<typeof useTiptapEditor>;

type BlockLevel = 'text' | 'h2' | 'h3';

/**
 * StarterKit's undo/redo commands exist at runtime, but their type augmentation ships in
 * @tiptap/extensions, which the admin doesn't depend on directly.
 */
interface HistoryCommands {
  undo: () => boolean;
  redo: () => boolean;
}
const historyCommands = (editor: Editor): HistoryCommands =>
  editor.commands as unknown as HistoryCommands;
const historyAvailability = (editor: Editor): HistoryCommands =>
  editor.can() as unknown as HistoryCommands;

/** Re-render on every editor transaction so active states follow the cursor. */
function useEditorUpdates(editor: Editor | null): void {
  const [, forceRender] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    if (!editor) return undefined;
    editor.on('transaction', forceRender);
    return () => {
      editor.off('transaction', forceRender);
    };
  }, [editor]);
}

const currentLevel = (editor: Editor): BlockLevel | null => {
  if (editor.isActive('heading', { level: 2 })) return 'h2';
  if (editor.isActive('heading', { level: 3 })) return 'h3';
  if (editor.isActive('paragraph')) return 'text';
  return null;
};

/** Small icon button with a tooltip and pressed state. */
const ToolButton: React.FC<{
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, active = false, disabled = false, onClick, children }) => (
  <Tooltip title={label}>
    <span>
      <IconButton
        size="small"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        sx={{
          borderRadius: 1,
          color: active ? 'primary.main' : 'text.secondary',
          bgcolor: active ? 'action.selected' : 'transparent',
        }}
      >
        {children}
      </IconButton>
    </span>
  </Tooltip>
);

/** In-page URL prompt (browser prompt() would block the page). */
const UrlDialog: React.FC<{
  open: boolean;
  title: string;
  initialValue?: string;
  confirmLabel: string;
  allowEmpty?: boolean;
  onClose: () => void;
  onConfirm: (url: string) => void;
}> = ({ open, title, initialValue = '', confirmLabel, allowEmpty = false, onClose, onConfirm }) => {
  const [url, setUrl] = useState<string>(initialValue);
  useEffect(() => {
    if (open) setUrl(initialValue);
  }, [open, initialValue]);
  const trimmed = url.trim();
  const isValid = trimmed === '' ? allowEmpty : /^(https?:\/\/|\/|mailto:)/i.test(trimmed);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="URL"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && isValid) {
              event.preventDefault();
              onConfirm(trimmed);
            }
          }}
          placeholder="https://…"
          error={trimmed !== '' && !isValid}
          helperText={
            allowEmpty ? 'Leave empty to remove the link' : 'Starts with https://, http:// or /'
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!isValid} onClick={() => onConfirm(trimmed)}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Uses TipTap's core commands (toggleMark, setNode, toggleList…): the per-extension shortcuts
 * like toggleBold() are typed in extension packages the admin doesn't depend on directly.
 *
 * Article editor toolbar (reference layout): block level Text/H2/H3, inline formats, link,
 * lists, undo/redo, and an "Insert" menu for block elements.
 */
export const ArticleToolbar: React.FC = () => {
  // Null until the editor mounts
  const editor = useTiptapEditor() as Editor | null;
  useEditorUpdates(editor);
  const [insertAnchor, setInsertAnchor] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<'link' | 'image' | null>(null);

  if (!editor) return null;
  const chain = () => editor.chain().focus();
  const level = currentLevel(editor);

  const setLevel = (_: React.MouseEvent, next: BlockLevel | null) => {
    if (!next) return;
    if (next === 'text') chain().setNode('paragraph').run();
    else
      chain()
        .setNode('heading', { level: next === 'h2' ? 2 : 3 })
        .run();
  };

  const applyLink = (url: string) => {
    setDialog(null);
    if (url === '') chain().extendMarkRange('link').unsetMark('link').run();
    else chain().extendMarkRange('link').setMark('link', { href: url }).run();
  };

  const insertImage = (url: string) => {
    setDialog(null);
    chain()
      .insertContent({ type: 'image', attrs: { src: url, alt: '' } })
      .run();
  };

  const insertItems: { label: string; icon: React.ReactNode; run: () => void }[] = [
    { label: 'Image', icon: <ImageIcon fontSize="small" />, run: () => setDialog('image') },
    {
      label: 'Quote',
      icon: <FormatQuote fontSize="small" />,
      run: () => chain().toggleWrap('blockquote').run(),
    },
    {
      label: 'Divider',
      icon: <HorizontalRule fontSize="small" />,
      run: () => chain().insertContent({ type: 'horizontalRule' }).run(),
    },
    {
      label: 'Code block',
      icon: <Code fontSize="small" />,
      run: () => chain().toggleNode('codeBlock', 'paragraph').run(),
    },
  ];

  return (
    <Box
      role="toolbar"
      aria-label="Formatting"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 0.5,
        p: 0.75,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        value={level}
        onChange={setLevel}
        aria-label="Block type"
      >
        <ToggleButton value="text" sx={{ px: 1.25, py: 0.25 }}>
          Text
        </ToggleButton>
        <ToggleButton value="h2" sx={{ px: 1.25, py: 0.25 }}>
          H2
        </ToggleButton>
        <ToggleButton value="h3" sx={{ px: 1.25, py: 0.25 }}>
          H3
        </ToggleButton>
      </ToggleButtonGroup>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <ToolButton
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => chain().toggleMark('bold').run()}
      >
        <FormatBold fontSize="small" />
      </ToolButton>
      <ToolButton
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => chain().toggleMark('italic').run()}
      >
        <FormatItalic fontSize="small" />
      </ToolButton>
      <ToolButton
        label="Underline"
        active={editor.isActive('underline')}
        onClick={() => chain().toggleMark('underline').run()}
      >
        <FormatUnderlined fontSize="small" />
      </ToolButton>
      <ToolButton label="Link" active={editor.isActive('link')} onClick={() => setDialog('link')}>
        <LinkIcon fontSize="small" />
      </ToolButton>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <ToolButton
        label="Bulleted list"
        active={editor.isActive('bulletList')}
        onClick={() => chain().toggleList('bulletList', 'listItem').run()}
      >
        <FormatListBulleted fontSize="small" />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => chain().toggleList('orderedList', 'listItem').run()}
      >
        <FormatListNumbered fontSize="small" />
      </ToolButton>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <ToolButton
        label="Undo"
        disabled={!historyAvailability(editor).undo()}
        onClick={() => historyCommands(editor).undo()}
      >
        <Undo fontSize="small" />
      </ToolButton>
      <ToolButton
        label="Redo"
        disabled={!historyAvailability(editor).redo()}
        onClick={() => historyCommands(editor).redo()}
      >
        <Redo fontSize="small" />
      </ToolButton>

      <Box sx={{ flex: 1 }} />
      <Button
        size="small"
        variant="contained"
        startIcon={<Add />}
        aria-haspopup="menu"
        aria-expanded={Boolean(insertAnchor)}
        onClick={(event) => setInsertAnchor(event.currentTarget)}
      >
        Insert
      </Button>
      <Menu
        anchorEl={insertAnchor}
        open={Boolean(insertAnchor)}
        onClose={() => setInsertAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {insertItems.map((item) => (
          <MenuItem
            key={item.label}
            onClick={() => {
              setInsertAnchor(null);
              item.run();
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <UrlDialog
        open={dialog === 'link'}
        title="Link"
        initialValue={(editor.getAttributes('link').href as string | undefined) ?? ''}
        confirmLabel="Apply"
        allowEmpty
        onClose={() => setDialog(null)}
        onConfirm={applyLink}
      />
      <UrlDialog
        open={dialog === 'image'}
        title="Insert image"
        confirmLabel="Insert"
        onClose={() => setDialog(null)}
        onConfirm={insertImage}
      />
    </Box>
  );
};
