import { normalizeSignalMessage } from './signalMessage';

describe('normalizeSignalMessage', () => {
  test('normalizes admin-change newAdmin to newAdminId', () => {
    expect(normalizeSignalMessage({
      type: 'admin-change',
      oldAdmin: 'a',
      newAdmin: 'b'
    })).toMatchObject({
      type: 'admin-change',
      newAdminId: 'b'
    });
  });

  test('keeps admin-change newAdminId', () => {
    expect(normalizeSignalMessage({
      type: 'admin-change',
      oldAdmin: 'a',
      newAdminId: 'c'
    })).toMatchObject({
      type: 'admin-change',
      newAdminId: 'c'
    });
  });

  test('returns null when required fields are missing', () => {
    expect(normalizeSignalMessage({ type: 'offer', sender: 'u1' })).toBeNull();
    expect(normalizeSignalMessage({ type: 'room-state' })).toBeNull();
  });

  test('returns null for unknown message types', () => {
    expect(normalizeSignalMessage({ type: 'unknown-message', sender: 'u1' })).toBeNull();
  });
});
