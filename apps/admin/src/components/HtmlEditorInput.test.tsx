import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminContext, Form, type DataProvider } from 'react-admin';
import { useWatch } from 'react-hook-form';
import { HtmlEditorInput, formatHtml } from './HtmlEditorInput';

const Value: React.FC = () => <output data-testid="value">{useWatch({ name: 'body' })}</output>;

const renderEditor = (body: string) =>
  render(
    <AdminContext dataProvider={{} as DataProvider}>
      <Form defaultValues={{ body }}>
        <HtmlEditorInput source="body" label="Content" />
        <Value />
      </Form>
    </AdminContext>,
  );

describe('formatHtml', () => {
  it('puts each block tag on its own line, leaving inline markup alone', () => {
    expect(formatHtml('<h2>Title</h2><p>One <strong>two</strong></p><ul><li>a</li></ul>')).toBe(
      '<h2>Title</h2>\n<p>One <strong>two</strong></p>\n<ul>\n<li>a</li>\n</ul>',
    );
  });

  it('is idempotent', () => {
    const once = formatHtml('<p>a</p><p>b</p>');
    expect(formatHtml(once)).toBe(once);
  });
});

describe('HtmlEditorInput', () => {
  it('starts in the visual editor', async () => {
    renderEditor('<p>Hello</p>');
    expect(await screen.findByRole('button', { name: 'Visual editor' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByLabelText('Content HTML')).not.toBeInTheDocument();
  });

  it('shows the formatted source in HTML mode and edits the same value', async () => {
    renderEditor('<p>One</p><p>Two</p>');

    await userEvent.click(await screen.findByRole('button', { name: 'HTML source' }));
    const source = screen.getByLabelText('Content HTML');
    expect(source).toHaveValue('<p>One</p>\n<p>Two</p>');

    await userEvent.clear(source);
    await userEvent.type(source, '<section>Custom</section>');
    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent('<section>Custom</section>'),
    );
  });
});
