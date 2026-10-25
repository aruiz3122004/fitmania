import type { UserRecord } from 'firebase-admin/auth';
import { getAdminAuth } from '@/lib/firebase-admin';

/**
 * Lista TODAS las cuentas de Firebase Auth paginando con `pageToken` (F2-20).
 * Antes `listUsers(1000)` cortaba la lista en 1000 cuentas sin avisar.
 */
export async function listAllAuthUsers(): Promise<UserRecord[]> {
  const auth = getAdminAuth();
  const users: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}
