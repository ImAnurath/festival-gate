import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getPaymentProvider } from "@/lib/payment";
import { assertPayable } from "@/lib/state-machine";

export default async function PayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const app = await prisma.application.findUnique({ where: { payToken: token } });

  if (!app) {
    return <main className="mx-auto max-w-lg p-8">Bu ödeme bağlantısı geçersiz.</main>;
  }
  if (app.status === "PAID") {
    return <main className="mx-auto max-w-lg p-8">Ödemeniz alınmıştır. {config.eventName} etkinliğinde görüşmek üzere!</main>;
  }

  try {
    assertPayable(app, new Date());
  } catch {
    return <main className="mx-auto max-w-lg p-8">Bu ödeme bağlantısının süresi dolmuş. Lütfen organizatörle iletişime geçin.</main>;
  }

  const amount = app.ticketQuantity * config.ticketPrice;
  const session = await getPaymentProvider().createCheckout({
    applicationId: app.id,
    amount,
    email: app.email,
    payToken: token,
  });

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">{config.eventName} Ödeme</h1>
      <p className="mt-4">{app.ticketQuantity} bilet: <strong>{amount} TL</strong></p>
      <a href={session.url} className="mt-6 inline-block bg-black px-4 py-2 text-white">
        Şimdi öde
      </a>
    </main>
  );
}
