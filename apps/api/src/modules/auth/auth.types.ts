import { EntitlementsDto } from '@fc/shared';

export type JwtPayload = {
  sub: string;
  email: string;
  /** Active laboratory. Personal labs use the founder's user id. */
  org?: string;
};

/** Laboratory bound to this session. Personal orgs share the founder's user id. */
export function activeOrg(user: { sub: string; org?: string }) {
  return user.org || user.sub;
}

export type AuthUserDto = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  plan: string;
  status: string;
  locale: string;
  theme: string;
  familyColors: Record<string, string> | null;
  defaultBatchTargetGrams: number;
  defaultConcentrationPct: number;
  defaultIfraCategory: number;
  createdAt: string;
  entitlements: EntitlementsDto;
  organization: {
    id: string;
    name: string;
    role: 'owner' | 'member';
  };
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthSession = AuthTokens & {
  user: AuthUserDto;
};
