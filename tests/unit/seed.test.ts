import { createDatabase } from '../../src/db';
import { UserService } from '../../src/services/userService';
import { seedDemoUser, DEMO_EMAIL, DEMO_PASSWORD } from '../../src/seed';

describe('seedDemoUser', () => {
  it('creates a demo user that can log in with the documented credentials', async () => {
    const db = createDatabase(':memory:');
    await seedDemoUser(db);

    const userService = new UserService(db);
    const { apiKey } = await userService.login(DEMO_EMAIL, DEMO_PASSWORD);
    expect(apiKey).toMatch(/^[0-9a-f]{48}$/);
  });

  it('is idempotent across repeated calls against the same DB', async () => {
    const db = createDatabase(':memory:');
    await seedDemoUser(db);
    await expect(seedDemoUser(db)).resolves.toBeUndefined();
  });
});
