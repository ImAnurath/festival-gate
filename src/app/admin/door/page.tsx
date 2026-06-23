import { redirect } from "next/navigation";

// The standalone door-collection page has moved into the mobile gate tool
// (/admin/m). This keeps any old link or bookmark working by sending it to the
// door tab there. The door server actions in this folder are still used by
// /admin/m/door.
export default function DoorPage() {
  redirect("/admin/m/door");
}
