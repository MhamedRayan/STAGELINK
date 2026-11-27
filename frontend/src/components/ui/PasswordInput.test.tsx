import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput', () => {
  it('toggles visibility without losing the value, focus or form ref', () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <PasswordInput
        ref={ref}
        defaultValue="secret"
        showLabel="Show password"
        hideLabel="Hide password"
      />,
    );

    const input = screen.getByDisplayValue('secret') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'password');
    expect(ref.current).toBe(input);
    input.focus();

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveValue('secret');
  });
});
