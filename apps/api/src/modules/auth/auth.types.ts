import { EntitlementsDto } from '@fc/shared';

export type JwtPayload = {
  sub: string;
  email: string;
};

export type AuthUserDto = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  plan: string;
  status: string;
  locale: string;
  theme: string;
  defaultBatchTargetGrams: number;
  defaultConcentrationPct: number;
  defaultIfraCategory: number;
  createdAt: string;
  entitlements: EntitlementsDto;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthSession = AuthTokens & {
  user: AuthUserDto;
};
