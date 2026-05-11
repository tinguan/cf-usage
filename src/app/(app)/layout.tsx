import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Nav />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
