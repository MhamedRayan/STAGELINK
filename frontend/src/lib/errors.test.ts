import { apiErrorFromBody, normalizeError } from './errors';

describe('errors', () => {
  it('reads DRF { detail }', () => {
    expect(apiErrorFromBody(401, { detail: 'No active account' }).message).toBe('No active account');
  });
  it('reads the { code, message, details } envelope', () => {
    const e = apiErrorFromBody(409, { code: 'offer_not_available', message: 'Offer closed', details: {} });
    expect(e.code).toBe('offer_not_available');
    expect(e.message).toBe('Offer closed');
  });
  it('maps field errors and falls back to the first one as message', () => {
    const e = apiErrorFromBody(400, { email: ['Already registered.'], password: ['Too weak.'] });
    expect(e.fieldErrors).toEqual({ email: 'Already registered.', password: 'Too weak.' });
    expect(e.message).toBe('Already registered.');
  });
  it('turns unknown throwables into status-0 errors', () => {
    expect(normalizeError(new Error('boom')).status).toBe(0);
  });
});
