import Link from 'next/link';
import {
  BookIcon,
  FolderIcon,
  GridIcon,
  InfogiphWordmark,
  SparkleIcon,
  UsersIcon,
} from './icons';

const navItems = [
  { label: 'Templates', href: '/', icon: GridIcon, active: true },
  { label: 'My Projects', href: '/dashboard', icon: FolderIcon },
  { label: 'Community', href: '/blog', icon: UsersIcon },
  { label: 'Docs & Help', href: '/docs', icon: BookIcon },
];

export function Sidebar() {
  return (
    <aside className="hidden md:block h-full w-[220px] shrink-0">
      <div className="relative flex h-full flex-col bg-[#fafafa]">
        <Link
          href="/"
          aria-label="Infogiph home"
          className="flex items-center gap-3 cursor-pointer px-5 pt-[22px] pb-4"
        >
          <InfogiphWordmark className="h-[30px] w-auto text-foreground" />
        </Link>

        <div className="px-3 mt-1">
          <Link
            href="/canvas"
            className="group flex w-full items-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
          >
            <SparkleIcon className="h-4 w-4" />
            <span>Create Infographic</span>
          </Link>
        </div>

        <nav className="mt-5 px-3 flex flex-col gap-1 text-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ' +
                  (item.active
                    ? 'bg-[#f0f0f0] text-foreground font-medium'
                    : 'text-foreground/80 hover:bg-[#f5f5f5]')
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto" />
      </div>
    </aside>
  );
}
