import { redirect } from "next/navigation";

// Moved to the Super Admin console.
export default function LegacyUsersPage() {
  redirect("/admin/users");
}
