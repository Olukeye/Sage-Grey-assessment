import type { Db } from '../../db/connection';

export interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  createdAt: Date;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const toUser = (row: Record<string, unknown>): UserRecord => ({
  id: row.id as string,
  email: row.email as string,
  fullName: row.full_name as string,
  passwordHash: row.password_hash as string,
  createdAt: new Date(row.created_at as string | number | Date),
});

const toToken = (row: Record<string, unknown>): RefreshTokenRecord => ({
  id: row.id as string,
  userId: row.user_id as string,
  familyId: row.family_id as string,
  expiresAt: new Date(row.expires_at as string | number | Date),
  revokedAt: row.revoked_at ? new Date(row.revoked_at as string | number | Date) : null,
});

export class AuthRepository {
  async findUserByEmail(db: Db, email: string): Promise<UserRecord | undefined> {
    const row = await db('users').where({ email }).first();
    return row && toUser(row);
  }

  async findUserById(db: Db, id: string): Promise<UserRecord | undefined> {
    const row = await db('users').where({ id }).first();
    return row && toUser(row);
  }

  async insertUser(db: Db, user: UserRecord): Promise<void> {
    await db('users').insert({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      password_hash: user.passwordHash,
      created_at: user.createdAt,
    });
  }

  async insertRefreshToken(
    db: Db,
    token: RefreshTokenRecord & { tokenHash: string; createdAt: Date },
  ): Promise<void> {
    await db('refresh_tokens').insert({
      id: token.id,
      user_id: token.userId,
      family_id: token.familyId,
      token_hash: token.tokenHash,
      expires_at: token.expiresAt,
      created_at: token.createdAt,
    });
  }

  async findRefreshTokenByHash(db: Db, tokenHash: string): Promise<RefreshTokenRecord | undefined> {
    const row = await db('refresh_tokens').where({ token_hash: tokenHash }).first();
    return row && toToken(row);
  }

  async revokeToken(db: Db, id: string, at: Date): Promise<boolean> {
    const updated = await db('refresh_tokens').where({ id }).whereNull('revoked_at').update({ revoked_at: at });
    return updated === 1;
  }

  async revokeFamily(db: Db, familyId: string, at: Date): Promise<void> {
    await db('refresh_tokens').where({ family_id: familyId }).whereNull('revoked_at').update({ revoked_at: at });
  }
}
