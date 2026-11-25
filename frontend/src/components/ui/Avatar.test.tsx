import { render, screen } from '@testing-library/react';
import { Avatar, avatarInitials } from './Avatar';

describe('avatarInitials', () => {
  it('uses the first letters of the first two name parts', () => {
    expect(avatarInitials('Dr. Salim Belkacem')).toBe('DS');
    expect(avatarInitials('  amina   njeri  ')).toBe('AN');
  });

  it('uses the first two letters of a single-word name', () => {
    expect(avatarInitials('StageLink')).toBe('ST');
  });

  it('falls back when no name is available', () => {
    expect(avatarInitials('')).toBe('SL');
    expect(avatarInitials(null)).toBe('SL');
  });
});

describe('Avatar', () => {
  it('renders deterministic initials with the caller size', () => {
    render(<Avatar name="Ada Lovelace" className="h-9 w-9" />);
    const avatar = screen.getByText('AL');
    expect(avatar).toHaveClass('h-9');
    expect(avatar).toHaveClass('w-9');
    expect(avatar).toHaveClass('bg-sage');
  });
});
