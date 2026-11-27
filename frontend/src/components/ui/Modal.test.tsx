import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from './Modal';

function Harness() {
  const [count, setCount] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Rerender {count}
      </button>
      <Modal open onClose={() => undefined} title="Test dialog">
        <input aria-label="First field" />
        <input aria-label="Password field" type="password" />
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('does not steal focus when the parent re-renders with a new onClose handler', () => {
    render(<Harness />);
    const rerender = screen.getByRole('button', { name: 'Rerender 0' });
    rerender.focus();

    fireEvent.click(rerender);

    expect(screen.getByRole('button', { name: 'Rerender 1' })).toHaveFocus();
    expect(screen.getByLabelText('First field')).not.toHaveFocus();
  });
});
