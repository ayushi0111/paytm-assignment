import { createDatabase } from '../../src/db';
import { UserService } from '../../src/services/userService';
import { ConflictError, InvalidInputError, UnauthorizedError } from '../../src/errors';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService(createDatabase(':memory:'));
  });

  describe('signup', () => {
    it('creates a user and returns an api key', async () => {
      const result = await service.signup('user@example.com', 'password123');
      expect(result.apiKey).toMatch(/^[0-9a-f]{48}$/);
    });

    it('rejects an invalid email', async () => {
      await expect(service.signup('not-an-email', 'password123')).rejects.toBeInstanceOf(InvalidInputError);
    });

    it('rejects a short password', async () => {
      await expect(service.signup('user@example.com', 'short')).rejects.toBeInstanceOf(InvalidInputError);
    });

    it('rejects a duplicate email regardless of case', async () => {
      await service.signup('user@example.com', 'password123');
      await expect(service.signup('USER@example.com', 'password123')).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('login', () => {
    it('returns the api key for correct credentials', async () => {
      const { apiKey } = await service.signup('user@example.com', 'password123');
      const result = await service.login('user@example.com', 'password123');
      expect(result.apiKey).toBe(apiKey);
    });

    it('is case-insensitive on email', async () => {
      const { apiKey } = await service.signup('user@example.com', 'password123');
      const result = await service.login('USER@example.com', 'password123');
      expect(result.apiKey).toBe(apiKey);
    });

    it('rejects an unknown email', async () => {
      await expect(service.login('nobody@example.com', 'password123')).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rejects a wrong password', async () => {
      await service.signup('user@example.com', 'password123');
      await expect(service.login('user@example.com', 'wrongpass')).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('findByApiKey', () => {
    it('finds the user for a valid key', async () => {
      const { apiKey } = await service.signup('user@example.com', 'password123');
      expect(service.findByApiKey(apiKey)?.email).toBe('user@example.com');
    });

    it('returns undefined for an unknown key', () => {
      expect(service.findByApiKey('nope')).toBeUndefined();
    });
  });
});
