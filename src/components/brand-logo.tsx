import Image from "next/image";

/**
 * Deniz'in Yeri Dua Yeri logo. The source has a white background; `multiply`
 * blends that white into the cream page so it reads as if transparent.
 * The artwork is square with internal padding, so width === height.
 */
export default function BrandLogo({
  size = 160,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.jpg"
      alt="Deniz'in Yeri Dua Yeri"
      width={size}
      height={size}
      priority={priority}
      className={`mix-blend-multiply ${className}`}
    />
  );
}
