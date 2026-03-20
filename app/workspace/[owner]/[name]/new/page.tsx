import { redirect } from "next/navigation";

export default async function NewFilePage() {
  redirect("/workspace/new");
}
