import { redirect } from "next/navigation";

export default async function RepositoryHomePage() {
  redirect("/workspace");
}
