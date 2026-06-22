import Scanner from "@/app/admin/scan/scanner";

export default function MobileScanPage() {
  return (
    <main className="px-4 py-6">
      <h1 className="font-display text-xl font-semibold text-ink">Kapı tarama</h1>
      <p className="mt-1 text-sm text-moss">
        Bileti kameraya gösterin ya da kodu elle girin.
      </p>
      <Scanner />
    </main>
  );
}
