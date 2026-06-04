import { config } from "@/lib/config";
import ApplyForm from "./apply-form";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;

  if (submitted) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-2xl font-bold">Teşekkürler</h1>
        <p className="mt-4">
          {config.eventName} için başvurunuz alındı. Onaylanırsanız,
          biletlerinizi satın almanız için size bir e-posta bağlantısı
          göndereceğiz.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">{config.eventName} için Başvuru</h1>
      <div className="mt-6">
        <ApplyForm maxTickets={config.maxTicketsPerBuyer} />
      </div>
    </main>
  );
}
