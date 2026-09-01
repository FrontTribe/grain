import { Sidebar } from "@/components/dashboard/Sidebar";
import { getUserAndOrg } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, org } = await getUserAndOrg();
  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "You";

  return (
    <div className="flex h-screen overflow-hidden bg-ground text-ink">
      <Sidebar
        orgName={org?.name ?? "Workspace"}
        plan={org?.plan ?? "team"}
        userName={name}
        userEmail={user?.email ?? ""}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
