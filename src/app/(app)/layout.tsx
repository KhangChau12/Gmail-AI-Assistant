import { Setup } from '@/components/Setup';
import { AppShell } from '@/components/shell/AppShell';
import { env, missingConfig } from '@/server/env';
import { getCounts, listCategories } from '@/server/repo';
import { syncStatus } from '@/server/sync';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const missing = missingConfig();
  if (missing.length) return <Setup missing={missing} />;

  return (
    <AppShell
      account={env.gmailAddress}
      model={env.openaiModel}
      initialSync={syncStatus()}
      initialCategories={listCategories()}
      initialCounts={getCounts()}
    >
      {children}
    </AppShell>
  );
}
