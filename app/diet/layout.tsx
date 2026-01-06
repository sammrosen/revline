import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Diet Calculator | Cyclic Strength',
  description: 'Calculate your personalized macro targets, hand portions, and meal structure based on your goals.',
};

export default function DietLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}









