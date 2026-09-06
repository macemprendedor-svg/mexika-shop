import { Sidebar } from "./_components/sidebar";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F3F5FA]">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden px-8 py-6">{children}</main>
    </div>
  );
}
