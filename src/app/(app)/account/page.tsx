import { PageHeader } from "@/components/ui";
import { AccountPanel } from "@/components/AccountPanel";
import { requireUser } from "@/lib/auth/session";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div>
      <PageHeader eyebrow="Account" title="My account" description="Your profile, password and signed-in devices." />
      <AccountPanel user={user} />
    </div>
  );
}
