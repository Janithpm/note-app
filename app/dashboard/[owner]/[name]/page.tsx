export default async function RepositoryHomePage({
  params
}: {
  params: Promise<{ owner: string; name: string }>
}) {
  const { owner, name } = await params;
  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome to {name}</h2>
        <p className="text-muted-foreground">
          Select a markdown file or diagram from the sidebar to start reviewing or editing your architecture documentation.
        </p>
      </div>
    </div>
  )
}
