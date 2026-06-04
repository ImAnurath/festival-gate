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
        <h1 className="text-2xl font-bold">Thank you</h1>
        <p className="mt-4">
          Your application for {config.eventName} has been received. If approved,
          you&apos;ll get an email with a link to buy your tickets.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">Apply for {config.eventName}</h1>
      <div className="mt-6">
        <ApplyForm maxTickets={config.maxTicketsPerBuyer} />
      </div>
    </main>
  );
}
