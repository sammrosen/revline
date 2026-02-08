'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon } from 'lucide-react';
import { useSidebar } from './SidebarContext';

interface NavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Match exact path only (default: false, matches prefix) */
  exact?: boolean;
}

export function NavItem({ href, icon: Icon, label, exact = false }: NavItemProps) {
  const pathname = usePathname();
  const { closeMobileSidebar } = useSidebar();
  
  const isActive = exact 
    ? pathname === href 
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={closeMobileSidebar}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
        ${isActive 
          ? 'bg-zinc-800 text-white' 
          : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
        }
      `}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
