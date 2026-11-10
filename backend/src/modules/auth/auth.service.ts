import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Knex } from 'knex';
import type { Config } from '../../config/env';
import type { Db } from '../../db/connection';
import { conflict, unauthorized } from '../../shared/errors';
import { isUniqueViolation } from '../../shared/dbErrors';
import type { AccountDto } from '../wallet/wallet.dto';
import type { WalletService } from '../wallet/wallet.service';
import type { AuthRepository, UserRecord } from './auth.repository';
import type { LoginInput, RegisterInput } from './auth.schemas';
import type { TokenService } from './auth.token.service';

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AuthResult {
  user: UserDto;
  account: AccountDto;
  tokens: AuthTokens;
}

const toUserDto = (user: UserRecord): UserDto => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  createdAt: user.createdAt.toISOString(),
});

export class AuthService {
  // Compared against when the email is unknown, so response time doesn't reveal which emails exist.
  private readonly dummyHash: string;

  constructor(
    private readonly db: Knex,
    private readonly config: Pick<Config, 'BCRYPT_ROUNDS' | 'REFRESH_TOKEN_TTL_DAYS' | 'ACCESS_TOKEN_TTL_SECONDS'>,
    private readonly repository: AuthRepository,
    private readonly tokens: TokenService,
    private readonly wallet: WalletService,
  ) {
    this.dummyHash = bcrypt.hashSync('not-a-real-password', config.BCRYPT_ROUNDS);
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(input.password, this.config.BCRYPT_ROUNDS);
    const user: UserRecord = {
      id: randomUUID(),
      email: input.email,
      fullName: input.fullName,
      passwordHash,
      createdAt: new Date(),
    };

    try {
      // User, wallet account and first session are created atomically: no half-registered users.
      return await this.db.transaction(async (trx) => {
        if (await this.repository.findUserByEmail(trx, user.email)) throw this.emailTaken();
        await this.repository.insertUser(trx, user);
        const account = await this.wallet.openAccount(trx, user.id);
        const tokens = await this.issueTokens(trx, user.id, randomUUID());
        return { user: toUserDto(user), account, tokens };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw this.emailTaken(); // lost a race with a concurrent registration
      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(this.db, input.email);
    const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !passwordOk) throw unauthorized('INVALID_CREDENTIALS', 'Incorrect email or password.');

    const account = await this.wallet.getAccountByUserId(this.db, user.id);
    const tokens = await this.issueTokens(this.db, user.id, randomUUID());
    return { user: toUserDto(user), account, tokens };
  }

  async refresh(rawToken: string): Promise<AuthTokens> {
    const stored = await this.repository.findRefreshTokenByHash(this.db, this.tokens.hashRefreshToken(rawToken));
    if (!stored) throw unauthorized('INVALID_TOKEN', 'The refresh token is invalid.');

    const now = new Date();
    if (stored.revokedAt) {
      await this.repository.revokeFamily(this.db, stored.familyId, now);
      throw unauthorized('TOKEN_REUSED', 'This refresh token was already used. Sign in again.');
    }
    if (stored.expiresAt <= now) throw unauthorized('INVALID_TOKEN', 'The refresh token has expired. Sign in again.');

    const rotated = await this.db.transaction(async (trx) => {
      const claimed = await this.repository.revokeToken(trx, stored.id, now);
      return claimed ? this.issueTokens(trx, stored.userId, stored.familyId) : null;
    });

    if (!rotated) {
      // A concurrent request consumed this token first: treat as reuse. Done outside the
      // transaction above so the revocation is committed rather than rolled back by the throw.
      await this.repository.revokeFamily(this.db, stored.familyId, now);
      throw unauthorized('TOKEN_REUSED', 'This refresh token was already used. Sign in again.');
    }
    return rotated;
  }

  async logout(rawToken: string): Promise<void> {
    const stored = await this.repository.findRefreshTokenByHash(this.db, this.tokens.hashRefreshToken(rawToken));
    if (stored) await this.repository.revokeFamily(this.db, stored.familyId, new Date());
  }

  async getProfile(userId: string): Promise<{ user: UserDto; account: AccountDto }> {
    const user = await this.repository.findUserById(this.db, userId);
    if (!user) throw unauthorized('UNAUTHENTICATED', 'This user no longer exists.');
    return { user: toUserDto(user), account: await this.wallet.getAccountByUserId(this.db, userId) };
  }

  private async issueTokens(db: Db, userId: string, familyId: string): Promise<AuthTokens> {
    const refresh = this.tokens.generateRefreshToken();
    const now = new Date();
    await this.repository.insertRefreshToken(db, {
      id: randomUUID(),
      userId,
      familyId,
      tokenHash: refresh.hash,
      expiresAt: new Date(now.getTime() + this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      revokedAt: null,
      createdAt: now,
    });
    return {
      accessToken: this.tokens.signAccessToken(userId),
      refreshToken: refresh.token,
      tokenType: 'Bearer',
      expiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  private emailTaken() {
    return conflict('EMAIL_TAKEN', 'An account with this email already exists.');
  }
}
