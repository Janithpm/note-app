export default async function DashboardPage() {
  return (
    <div className="container max-w-6xl py-6 lg:py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome to your architecture workspace. Connect to GitHub to start managing your notes and diagrams.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Temporary placeholder cards */}
          <div className="rounded-xl border bg-card text-card-foreground shadow">
            <div className="p-6">
              <h3 className="font-semibold leading-none tracking-tight">Repositories</h3>
              <p className="text-sm text-muted-foreground mt-2">Connect a GitHub repository to get started.</p>
            </div>
          </div>
          <div className="rounded-xl border bg-card text-card-foreground shadow">
            <div className="p-6">
              <h3 className="font-semibold leading-none tracking-tight">Recent Notes</h3>
              <p className="text-sm text-muted-foreground mt-2">Your recently edited architecture notes will appear here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
