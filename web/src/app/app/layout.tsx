import { Sidebar } from "@/components/dashboard/Sidebar";
import { getUserAndOrg, getMyOrgs, getActiveOrgId } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ user, org }, orgs, activeOrgId] = await Promise.all([getUserAndOrg(), getMyOrgs(), getActiveOrgId()]);
  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "You";

  return (
    <div className="flex h-screen overflow-hidden bg-ground text-ink">
      <Sidebar
        orgName={org?.name ?? "Workspace"}
        plan={org?.plan ?? "team"}
        userName={name}
        userEmail={user?.email ?? ""}
        orgs={orgs.map((o) => ({ org_id: o.org_id, name: o.name }))}
        activeOrgId={activeOrgId}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
