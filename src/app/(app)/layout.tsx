import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar, MobileNav } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar userName={session.name} />
      <main className="min-w-0 flex-1 overflow-x-hidden pb-16 md:pb-0">
        <div className="mx-auto max-w-6xl p-4 md:p-8">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
