import Link from 'next/link';
import { BookIcon, FolderIcon, GridIcon, UsersIcon } from './icons';

const items = [
  { label: 'Templates', href: '/', icon: GridIcon, active: true },
  { label: 'Projects', href: '/dashboard', icon: FolderIcon },
  { label: 'Blog', href: '/blog', icon: UsersIcon },
  { label: 'Docs', href: '/docs', icon: BookIcon },
];

export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/90 backdrop-blur border-t border-border">
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={
                'flex flex-col items-center justify-center gap-1 py-3 text-[11px] ' +
                (item.active ? 'text-foreground' : 'text-muted-foreground')
              }
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
