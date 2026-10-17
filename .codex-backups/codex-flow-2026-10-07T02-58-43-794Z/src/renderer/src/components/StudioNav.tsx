import { BookOpen, Clapperboard, Search, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { useApp } from '../store/app'
import { Logo } from './Logo'
import { Button, cx } from './ui'

export function StudioNav({ active, right, disabled = false }: { active: 'home' | 'research' | 'masters'; right?: ReactNode; disabled?: boolean }) {
  const go = useApp((s) => s.go)
  return <header className="flex h-[76px] shrink-0 items-center gap-7 border-b border-line bg-surface px-8">
    <Logo />
    <nav aria-label="Studio" className="flex items-center gap-1 rounded-xl bg-sand p-1">
      {[{ id: 'home', name: 'Studio', icon: Clapperboard }, { id: 'research', name: 'Riset topik', icon: Search }, { id: 'masters', name: 'Master prompt', icon: BookOpen }].map(({ id, name, icon: Icon }) => <button key={id} type="button" disabled={disabled} aria-current={active === id ? 'page' : undefined} onClick={() => go({ name: id as 'home' | 'research' | 'masters' })} className={cx('flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50', active === id ? 'bg-ink text-paper shadow-sm' : 'text-ink-2 hover:bg-surface')}><Icon className="size-4" />{name}</button>)}
    </nav>
    <div className="flex-1" />
    {right}
    <Button size="sm" disabled={disabled} icon={<SlidersHorizontal className="size-4" />} onClick={() => go({ name: 'settings', back: { name: active } })}>Pengaturan</Button>
  </header>
}
