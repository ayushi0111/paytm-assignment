import { DB } from './db';
import { UserService } from './services/userService';
import { ConflictError } from './errors';

export const DEMO_EMAIL = 'demo@example.com';
export const DEMO_PASSWORD = 'demo12345';

/**
 * Dev/demo convenience only: ensures a fixed demo account exists so anyone
 * cloning the repo can log in immediately instead of having to sign up
 * first. Idempotent - safe to call on every startup against a persistent DB.
 */
export async function seedDemoUser(db: DB): Promise<void> {
  const userService = new UserService(db);
  try {
    await userService.signup(DEMO_EMAIL, DEMO_PASSWORD);
    console.log(`Seeded demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } catch (err) {
    if (err instanceof ConflictError) return;
    throw err;
  }
}
