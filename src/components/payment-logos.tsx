import Image from "next/image";

/**
 * Official iyzico footer logo band (the "iyzico ile öde" band, which also
 * carries the Visa/Mastercard and other card-scheme marks). Source SVG comes
 * from iyzico's official logo pack: /public/payment/iyzico-logo-band.svg.
 * Satisfies iyzico's requirement to display the payment-method logos.
 */
export default function PaymentLogos({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <Image
        src="/payment/iyzico-logo-band.svg"
        alt="iyzico ile öde — Visa, Mastercard güvenli ödeme"
        width={429}
        height={32}
        className="h-auto w-full max-w-[360px]"
      />
    </div>
  );
}
