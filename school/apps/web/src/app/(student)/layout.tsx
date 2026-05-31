export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-white border-b border-border px-6 py-4">
        <h2 className="text-lg font-bold text-primary">منصة الطالب</h2>
      </header>
      <main className="max-w-5xl mx-auto p-6">{children}</main>
    </div>
  );
}
