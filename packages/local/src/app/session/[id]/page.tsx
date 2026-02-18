import SessionPageClient from "./SessionPageClient";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function SessionPage() {
  return <SessionPageClient />;
}
