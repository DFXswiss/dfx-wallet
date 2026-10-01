import { resolveIncomingPath } from '@/config/deep-links';

type RedirectSystemPathOptions = {
  path: string;
  initial: boolean;
};

export function redirectSystemPath({ path, initial }: RedirectSystemPathOptions): string {
  try {
    return resolveIncomingPath(path, initial);
  } catch {
    return '/';
  }
}
