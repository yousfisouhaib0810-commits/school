export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">لوحة التحكم</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-border p-6">
          <h3 className="text-sm text-muted-foreground mb-1">المواد</h3>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-6">
          <h3 className="text-sm text-muted-foreground mb-1">الطلاب</h3>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-6">
          <h3 className="text-sm text-muted-foreground mb-1">الدروس</h3>
          <p className="text-3xl font-bold">0</p>
        </div>
      </div>
    </div>
  );
}
