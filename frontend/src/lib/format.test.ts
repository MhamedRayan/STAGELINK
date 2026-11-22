import { formatDate, formatDateTime, formatGrade, formatRelative } from './format';

describe('format', () => {
  it('formats dates as dd/mm/yyyy in Africa/Algiers', () => {
    expect(formatDate('2026-11-22T10:00:00Z')).toBe('22/11/2026');
    expect(formatDate('2026-11-22T23:30:00Z')).toBe('23/11/2026'); // UTC+1 crosses midnight
  });
  it('formats timestamps as dd/mm/yyyy HH:mm', () => {
    expect(formatDateTime('2026-11-22T10:05:00Z')).toBe('22/11/2026 11:05');
  });
  it('handles empty/invalid input', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('nope')).toBe('—');
  });
  it('formats relative time', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    expect(formatRelative('2026-11-22T10:00:00Z', now)).toBe('2 hours ago');
  });
  it('formats grades', () => {
    expect(formatGrade('17.50')).toBe('17.5');
    expect(formatGrade('17.00')).toBe('17');
    expect(formatGrade(null)).toBe('—');
  });
});
