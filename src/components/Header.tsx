import Link from 'next/link';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full bg-white dark:bg-black border-b-2 wf-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 wf-border flex items-center justify-center font-bold">
            10
          </div>
          <span className="text-xl font-black">
            DUCK
          </span>
        </Link>
        
        <nav className="hidden md:flex gap-8 text-xs font-bold uppercase tracking-widest">
          <Link href="#" className="hover:underline">COMMUNITY</Link>
          <Link href="#" className="hover:underline">GALLERY</Link>
          <Link href="#" className="hover:underline">WIKI</Link>
          <Link href="#" className="hover:underline">EVENT</Link>
        </nav>
        
        <div className="flex items-center gap-4">
          <button className="p-2 wf-border flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
          <button className="px-5 py-2 text-xs font-bold wf-border-thick hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            SIGN_IN
          </button>
        </div>
      </div>
    </header>
  );
}
