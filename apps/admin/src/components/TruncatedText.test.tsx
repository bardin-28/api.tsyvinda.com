import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecordContextProvider } from 'react-admin';
import { TruncatedText, TruncatedTextField } from './TruncatedText';

/** jsdom has no layout: fake the widths the component compares on hover. */
function setWidths(element: HTMLElement, scrollWidth: number, clientWidth: number) {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: clientWidth });
}

const longTitle = 'Protecting Your Wallet from DDoS Attacks: Hiding Your Origin Server';

describe('TruncatedText', () => {
  it('shows the full text in a tooltip when it overflows', async () => {
    render(<TruncatedText text={longTitle} />);
    const text = screen.getByText(longTitle);
    expect(text).toHaveStyle({ textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

    setWidths(text, 600, 320);
    fireEvent.mouseOver(text);
    fireEvent.mouseEnter(text);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(longTitle);
  });

  it('shows no tooltip when the text fits', async () => {
    render(<TruncatedText text="Short" />);
    const text = screen.getByText('Short');
    setWidths(text, 40, 320);
    fireEvent.mouseOver(text);
    fireEvent.mouseEnter(text);

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders the empty-cell marker for missing text', () => {
    render(<TruncatedText text={null} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('reads the field value from the record', () => {
    render(
      <RecordContextProvider value={{ id: 1, title: longTitle }}>
        <TruncatedTextField source="title" />
      </RecordContextProvider>,
    );
    expect(screen.getByText(longTitle)).toBeInTheDocument();
  });
});
