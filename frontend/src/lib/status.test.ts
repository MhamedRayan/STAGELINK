import { APPLICATION_STATUS, getStatusInfo } from './status';

describe('status maps', () => {
  it('covers every application status from the plan', () => {
    expect(Object.keys(APPLICATION_STATUS)).toHaveLength(9);
    expect(getStatusInfo('application', 'COMPANY_ACCEPTED')).toEqual({
      label: 'Pending university validation',
      tone: 'warning',
    });
  });
  it('keeps vocabularies separate (case-sensitive)', () => {
    expect(getStatusInfo('offer', 'published').label).toBe('Open');
    expect(getStatusInfo('application', 'published').tone).toBe('neutral'); // unknown → raw value
  });
});
