import { DB } from '../db';
import { hashPassword, verifyPassword } from '../auth/password';
import { generateApiKey } from '../auth/apiKey';
import { ConflictError, InvalidInputError, UnauthorizedError } from '../errors';
import { User } from '../types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export class UserService {
  constructor(private db: DB) {}

  async signup(email: unknown, password: unknown): Promise<{ apiKey: string }> {
    if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
      throw new InvalidInputError('A valid email address is required');
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new InvalidInputError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = this.db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await hashPassword(password);
    const apiKey = generateApiKey();

    this.db
      .prepare('INSERT INTO users (email, password_hash, api_key) VALUES (?, ?, ?)')
      .run(normalizedEmail, passwordHash, apiKey);

    return { apiKey };
  }

  async login(email: unknown, password: unknown): Promise<{ apiKey: string }> {
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new InvalidInputError('Email and password are required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = this.db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as User | undefined;
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new UnauthorizedError('Invalid email or password');
    }

    return { apiKey: user.api_key };
  }

  findByApiKey(apiKey: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE api_key = ?').get(apiKey) as User | undefined;
  }
}
