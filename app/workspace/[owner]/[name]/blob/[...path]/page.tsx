import { redirect } from "next/navigation";

export default async function BlobPage({
  params
}: {
  params: Promise<{ owner: string; name: string; path: string[] }>
}) {
  const { path } = await params;
  const filePath = path.join("/");

  redirect(`/workspace/blob/${filePath}`);
}
