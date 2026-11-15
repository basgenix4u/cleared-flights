import { ButtonLink } from "@/components/ui/ui";
import { Sign } from "@/components/ui/marks";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <Sign code="404" size="xl" />
      <h1 className="mt-6 text-[28px] font-bold tracking-[-0.03em]">That gate doesn’t exist</h1>
      <p className="mt-2 text-ink-3">The page you’re looking for has moved or never existed.</p>
      <div className="mt-6 flex justify-center gap-2">
        <ButtonLink href="/" variant="signal">Back to search</ButtonLink>
        <ButtonLink href="/trips" variant="outline">Find a trip</ButtonLink>
      </div>
    </div>
  );
}
