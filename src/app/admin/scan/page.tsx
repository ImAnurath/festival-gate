import { redirect } from "next/navigation";

// The standalone scan page has moved into the mobile gate tool (/admin/m). This
// keeps any old link or bookmark working by sending it to the scan tab there.
// The Scanner component and the verify/collect routes in this folder are still
// used by /admin/m/scan.
export default function ScanPage() {
  redirect("/admin/m/scan");
}
