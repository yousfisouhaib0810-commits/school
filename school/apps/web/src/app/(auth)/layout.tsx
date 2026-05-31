export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f4ec]" dir="rtl">
      <div className="w-full max-w-md p-8">{children}</div>
    </div>
  );
}
