import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Year Semi-Private Program | Sports West',
  description: 'Small-group strength training at Sports West with structured programming, simple nutrition guidance, and real accountability.',
};

export default function SemiPrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}







