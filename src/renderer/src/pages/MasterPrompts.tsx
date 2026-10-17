import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, Copy, FileText, LockKeyhole, Plus, Save, Trash2, Upload } from 'lucide-react'
import { builtInMasterPrompts, createCustomMasterPrompt, isLegacyMapMaster, mapFillMode, mapTargetColor, MASTER_PROMPT_STAGES, resolveMasterPrompt, validateMasterPrompt, type MasterPromptProfile, type MasterPromptStage } from '@shared/master-prompts'
import { StudioNav } from '../components/StudioNav'
import { Button, confirmDialog, cx } from '../components/ui'
import { useApp, type Route } from '../store/app'
import { errorText } from '../lib/format'
import { normalizeProjectClipMotion } from '../store/project'

const STAGES: Record<MasterPromptStage, { name: string; hint: string }> = {
  research: { name: 'Riset & ide', hint: 'Sumber, sudut cerita, cara menilai topik, dan kriteria ide.' },
  script: { name: 'Naskah', hint: 'Struktur cerita, pembuka, gaya bahasa, fakta, serta larangan.' },
  visual: { name: 'Gambar', hint: 'Komposisi, karakter, material, warna, dan aturan setiap gambar.' },
  video: { name: 'Video', hint: 'Gerakan, kamera, transisi, durasi sumber video, dan suara adegan.' },
  thumbnail: { name: 'Thumbnail', hint: 'Hierarki objek, teks singkat, rasio, dan kontras.' },
  voice: { name: 'Suara', hint: 'Karakter narator, tempo, pelafalan, dan emosi. Pengaturan layanan suara tetap mengikuti pilihan proyek.' }
}
type Tab = 'source' | MasterPromptStage | 'timing' | 'subjects'

export function MasterPrompts({ back }: { back?: Route }) {
  const { go, toast } = useApp()
  const [profiles, setProfiles] = useState<MasterPromptProfile[]>(builtInMasterPrompts)
  const [draft, setDraft] = useState<MasterPromptProfile>(() => structuredClone(builtInMasterPrompts.find((p) => p.id === 'builtin:vox')!))
  const [tab, setTab] = useState<Tab>('script')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [raw, setRaw] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const builtin = draft.id.startsWith('builtin:')
  const stored = profiles.some((p) => p.id === draft.id)
  useEffect(() => { let alive = true; void window.api.masterPrompts.list().then((items) => { if (alive) setProfiles(items) }).catch((e) => { if (alive) setError(errorText(e)) }); return () => { alive = false } }, [])
  useEffect(() => { if (back?.name !== 'project') return; let alive = true; void window.api.projects.get(back.id).then((bundle) => { const current = resolveMasterPrompt(bundle.project); if (alive && current) setDraft(structuredClone(current)) }).catch((e) => { if (alive) setError(errorText(e)) }); return () => { alive = false } }, [back?.name === 'project' ? back.id : null])

  const discard = async (): Promise<boolean> => !dirty || confirmDialog({ title: 'Tinggalkan perubahan?', body: 'Perubahan pada master ini belum disimpan ke pustaka.', confirm: 'Tinggalkan' })
  const select = async (profile: MasterPromptProfile): Promise<void> => { if (!(await discard())) return; setDraft(structuredClone(profile)); setDirty(false); setError(''); setImporting(false) }
  const patch = (value: Partial<MasterPromptProfile>): void => { setDraft((p) => ({ ...p, ...value })); setDirty(true); setError('') }
  const copy = async (): Promise<void> => { if (!(await discard())) return; setDraft({ ...structuredClone(draft), id: `custom:${crypto.randomUUID()}`, name: `${draft.name} · pribadi`, version: 1 }); setDirty(true); setError(''); setImporting(false) }
  const begin = async (): Promise<void> => { if (!(await discard())) return; setImporting(true); setError(''); setRaw('') }
  const parseImport = (text: string): void => {
    try {
      const trimmed = text.trim()
      const profile = trimmed.startsWith('{') ? validateMasterPrompt(JSON.parse(trimmed)) : createCustomMasterPrompt(text)
      setDraft({ ...profile, id: `custom:${crypto.randomUUID()}`, version: 1 }); setDirty(true); setImporting(false); setTab('source'); setError('')
      toast('info', 'Draf master siap. Periksa aturan per tahap sebelum menyimpan.')
    } catch (e) { setError(errorText(e)) }
  }
  const save = async (): Promise<void> => {
    setBusy(true); setError('')
    try { const saved = await window.api.masterPrompts.save(validateMasterPrompt(draft)); setProfiles((p) => [...p.filter((item) => item.id !== saved.id), saved]); setDraft(saved); setDirty(false); toast('success', `${saved.name} v${saved.version} tersimpan. Proyek sebelumnya tetap memakai versinya.`) } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  const remove = async (): Promise<void> => {
    if (!(await confirmDialog({ title: 'Hapus dari pustaka?', body: 'Proyek yang sudah memakai master ini tetap menyimpan aturan dan versinya.', confirm: 'Hapus master', danger: true }))) return
    setBusy(true)
    try { await window.api.masterPrompts.remove(draft.id); setProfiles((p) => p.filter((item) => item.id !== draft.id)); setDraft(structuredClone(builtInMasterPrompts[0])); setDirty(false) } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  const apply = async (): Promise<void> => {
    if (back?.name !== 'project' || dirty) return
    setBusy(true); setError('')
    try {
      const bundle = await window.api.projects.get(back.id)
      const changed = JSON.stringify(bundle.project.masterPrompt) !== JSON.stringify(draft)
      const project = { ...bundle.project, masterPrompt: structuredClone(draft),
        ...(draft.baseProfile === 'stickman' ? { styleId: 'stickman', skillId: 'general' as const, skillVariant: undefined } : {}),
        ...(draft.baseProfile === 'map' ? { styleId: 'map-animation', skillId: 'general' as const, skillVariant: undefined, ...(!bundle.clips.length ? { durationSec: 32, aspectRatio: '9:16' as const } : {}) } : {}) }
      const clips = changed ? bundle.clips.map((c) => normalizeProjectClipMotion(project, { ...c, visualSource: `${c.story || c.narration}\nMASTER:aturan diperbarui` })) : bundle.clips
      await window.api.projects.save({ project, characters: bundle.characters, clips })
      toast('success', 'Master diterapkan. Tinjau dan perbarui rencana visual untuk mengikuti aturan baru.'); go(back)
    } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }

  return <div className="flex h-full flex-col">
    <StudioNav active="masters" disabled={dirty || busy || importing} right={back ? <Button size="sm" disabled={busy} icon={<ArrowLeft className="size-4" />} onClick={async () => { if (await discard()) go(back) }}>Kembali</Button> : undefined} />
    <main className="scroll-thin min-h-0 flex-1 overflow-y-auto px-8 py-7">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-7 flex items-end justify-between gap-6"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-accent">NARAFLOW / ATURAN PRODUKSI</p><h1 className="font-display text-[38px] font-bold tracking-tight">Satu pustaka. Banyak cara bercerita.</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">Pilih aturan produksi, lalu padukan dengan gaya visual. Simpan master sendiri dan atur instruksi untuk setiap tahap.</p></div><Button variant="ink" disabled={busy} icon={<Plus className="size-4" />} onClick={() => void begin()}>Master baru</Button></div>
        <div className="grid grid-cols-[280px_minmax(0,1fr)] items-start gap-6">
          <aside className="flex flex-col gap-2">
            <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-widest text-muted">Pustaka master · {profiles.length}</p>
            {profiles.map((profile) => <button key={profile.id} type="button" disabled={busy} onClick={() => void select(profile)} className={cx('rounded-xl border p-4 text-left transition-colors', draft.id === profile.id && !importing ? 'border-ink bg-ink text-paper shadow-ink' : 'border-line bg-surface hover:border-line-3')}><div className="flex items-center justify-between gap-2"><BookOpen className={cx('mb-3 size-5', draft.id === profile.id && !importing ? 'text-sun' : 'text-accent')} /><span className="text-[10px] uppercase tracking-wider opacity-65">{profile.id.startsWith('builtin:') ? 'Bawaan' : `Pribadi · v${profile.version}`}</span></div><p className="text-sm font-bold">{profile.name}</p><p className="mt-1.5 line-clamp-2 text-xs leading-relaxed opacity-70">{profile.description}</p></button>)}
            <p className="mt-3 px-1 text-xs leading-relaxed text-muted">Setiap proyek menyimpan salinan aturan. Mengedit atau menghapus master di pustaka tidak mengubah proyek yang sudah dibuat.</p>
          </aside>
          <section className="overflow-hidden rounded-2xl border border-line bg-surface">
            {importing ? <div className="p-7"><div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-sand p-3"><FileText className="size-6" /></span><div><h2 className="font-display text-2xl font-bold">Masukkan master prompt</h2><p className="mt-1 text-sm text-ink-2">Tempel teks atau impor berkas .txt, .md, atau profil .json.</p></div></div><textarea aria-label="Master prompt asli untuk impor" value={raw} onChange={(e) => setRaw(e.target.value)} maxLength={100000} rows={16} placeholder={'Nama master prompt\n\n# Naskah\nAturan penulisan...\n\n# Gambar\nAturan visual...\n\n# Video\nAturan gerakan...'} className="w-full resize-y rounded-xl border border-line-2 bg-paper p-4 text-sm leading-relaxed outline-none focus:border-accent" /><p className="mt-2 text-xs leading-relaxed text-muted">Judul bagian membantu pemetaan awal. Teks asli disimpan utuh; periksa hasil pemetaan sebelum dipakai.</p><input ref={input} type="file" accept=".txt,.md,.json" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 500000) throw new Error('Berkas terlalu besar. Maksimal 500 KB.'); const text = await file.text(); if (text.length > 100000) throw new Error('Master prompt maksimal 100.000 karakter.'); setRaw(text) } catch (err) { setError(errorText(err)) } e.target.value = '' }} /><div className="mt-5 flex gap-2"><Button icon={<Upload className="size-4" />} onClick={() => input.current?.click()}>Pilih berkas</Button><div className="flex-1" /><Button onClick={() => setImporting(false)}>Batal</Button><Button variant="primary" disabled={!raw.trim()} onClick={() => parseImport(raw)}>Tinjau aturan<ArrowRight className="size-4" /></Button></div></div> : <>
              <div className="border-b border-line p-6"><div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted">{builtin ? <LockKeyhole className="size-3.5" /> : <FileText className="size-3.5" />}{builtin ? 'Master bawaan' : 'Master pribadi'}<span className="ml-auto rounded-full bg-sand px-2 py-1 normal-case tracking-normal">Versi {draft.version}{dirty ? ' · perubahan belum disimpan' : ''}</span></div><input aria-label="Nama master prompt" value={draft.name} readOnly={builtin} maxLength={120} onChange={(e) => patch({ name: e.target.value })} className="w-full bg-transparent font-display text-[27px] font-bold outline-none" /><textarea aria-label="Deskripsi master prompt" value={draft.description} readOnly={builtin} maxLength={1500} onChange={(e) => patch({ description: e.target.value })} rows={2} className="mt-2 w-full resize-none bg-transparent text-sm leading-relaxed text-ink-2 outline-none" /><div className="mt-3 flex flex-wrap items-center gap-2"><Button size="sm" icon={<Copy className="size-3.5" />} onClick={() => void copy()}>Buat salinan</Button><Button size="sm" variant="ghost" onClick={() => void window.api.app.copyText(JSON.stringify(draft, null, 2)).then(() => toast('success', 'Profil JSON disalin.')).catch((e) => setError(errorText(e)))}>Salin profil JSON</Button>{builtin && <span className="ml-1 text-xs text-muted">Buat salinan untuk menyesuaikan aturan.</span>}</div></div>
              <div role="tablist" aria-label="Bagian master prompt" className="flex flex-wrap gap-1 border-b border-line bg-paper px-5 py-3">{[{ id: 'source', name: 'Teks asli' }, ...MASTER_PROMPT_STAGES.map((id) => ({ id, name: STAGES[id].name })), { id: 'subjects', name: 'Niche & durasi' }, { id: 'timing', name: 'Ritme & kamera' }].map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id as Tab)} className={cx('rounded-lg px-3 py-2 text-xs font-semibold', tab === item.id ? 'bg-ink text-white' : 'text-ink-2 hover:bg-sand')}>{item.name}</button>)}</div>
              <div role="tabpanel" className="p-6">
                {tab === 'timing' && draft.baseProfile === 'map' && !isLegacyMapMaster({ masterPrompt: draft, styleId: 'map-animation' }) && <div data-map-settings className="mb-6 space-y-4 rounded-xl border border-line-2 bg-paper p-4">
                  <div><h3 className="text-base font-bold">Territory Highlight</h3><p className="mt-1 text-xs leading-relaxed text-ink-2">Peta siang terang dengan warna natural redup, bidang wilayah datar, garis putih, dan ikon sticker. Warna target tetap sama di seluruh video.</p></div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="text-xs font-semibold">Bidang wilayah<select aria-label="Mode bidang wilayah peta" disabled={builtin} value={mapFillMode({ masterPrompt: draft })} onChange={(event) => patch({ mapFillMode: event.target.value as 'generated' | 'post' })} className="mt-2 block w-full rounded-lg border border-line-2 bg-surface p-3 text-sm font-normal"><option value="generated">GENERATED · dibuat bersama peta</option><option value="post">POST · ditambahkan saat editing</option></select></label>
                    <label className="text-xs font-semibold">Warna target<select aria-label="Warna target peta" disabled={builtin} value={mapTargetColor({ masterPrompt: draft })} onChange={(event) => patch({ mapTargetColor: event.target.value as 'orange' | 'rose' })} className="mt-2 block w-full rounded-lg border border-line-2 bg-surface p-3 text-sm font-normal"><option value="orange">Orange · #D3631F / 85%</option><option value="rose">Rose red · #B85B54 / 60%</option></select></label>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">Jika batas wilayah terdistorsi, pilih POST: generator hanya membuat basemap dan gerak kamera. Bidang wilayah dan garis putih harus dibuat dari data vektor saat editing; Naraflow menyiapkan panduannya, bukan menggambarnya otomatis. Label dan angka selalu ditambahkan saat editing.</p>
                </div>}
                {tab === 'subjects' ? <div className="space-y-5"><div><h3 className="text-base font-bold">Rekomendasi subjek dan durasi</h3><p className="mt-1 text-sm leading-relaxed text-ink-2">Atur daftar niche untuk master ini. Proyek tetap dapat memilih niche dan durasi custom.</p></div><label className="flex flex-col gap-2 text-sm font-semibold">Niche master · satu per baris<textarea aria-label="Niche master" readOnly={builtin} rows={12} maxLength={10000} value={(draft.subjectNiches ?? []).join('\n')} onChange={(event) => patch({ subjectNiches: event.target.value.split('\n') })} placeholder="Ancient Humans\nHuman Evolution\nScience" className="rounded-xl border border-line-2 bg-paper p-3 text-sm font-normal leading-relaxed outline-none focus:border-accent" /><span className="text-xs font-normal text-muted">Daftar yang ditulis di sini menggantikan rekomendasi niche gaya visual. Hapus aturan daftar untuk kembali mengikuti gaya.</span></label>{!builtin && <Button size="sm" onClick={() => patch({ subjectNiches: undefined })}>Ikuti rekomendasi gaya</Button>}<label className="flex flex-col gap-2 text-sm font-semibold">Pilihan durasi · menit, pisahkan dengan koma<input key={`durations-${draft.id}-${draft.version}`} aria-label="Pilihan durasi master dalam menit" readOnly={builtin} defaultValue={(draft.durationOptionsSec ?? []).map((seconds) => seconds / 60).join(', ')} placeholder="3, 8, 12, 20" onBlur={(event) => { if (builtin) return; const text = event.target.value.trim(); patch({ durationOptionsSec: text ? text.split(/[,;]+/).map((value) => Number(value.trim()) * 60) : undefined }) }} className="h-11 rounded-lg border border-line-2 bg-paper px-3 text-sm font-normal outline-none focus:border-accent" /><span className="text-xs font-normal text-muted">Preset ditampilkan sesudah ide dipilih. Durasi custom tetap tersedia.</span></label></div> :
                tab === 'timing' ? <div className="space-y-6"><div><h3 className="text-base font-bold">Ritme mengikuti cerita</h3><p className="mt-1 text-sm text-ink-2">Angka ini menjadi sasaran penyusunan, bukan alasan menolak naskah yang lengkap.</p></div><div className="grid grid-cols-2 gap-4">{([{ key: 'wordsPerSecond', label: 'Kata per detik', min: .1, max: 20 }, { key: 'beatSeconds', label: 'Detik per beat', min: .1, max: 120 }, { key: 'sourceVideoSeconds', label: 'Detik video sumber', min: 1, max: 600 }, { key: 'sceneCount', label: 'Jumlah adegan', min: 1, max: 500 }] as const).map((item) => <label key={item.key} className="text-xs font-semibold">{item.label}<input type="number" min={item.min} max={item.max} step={item.key === 'sceneCount' ? 1 : 0.1} readOnly={builtin} aria-label={item.label} value={draft.timing[item.key] ?? ''} placeholder="Otomatis" onChange={(e) => patch({ timing: { ...draft.timing, [item.key]: e.target.value === '' ? undefined : Number(e.target.value) } })} className="mt-2 w-full rounded-lg border border-line-2 bg-paper p-3 text-sm font-normal outline-none focus:border-accent" /></label>)}</div><label className="block text-sm font-semibold">Dasar aturan<select aria-label="Dasar aturan" disabled={builtin} value={draft.baseProfile} onChange={(e) => patch({ baseProfile: e.target.value as MasterPromptProfile['baseProfile'] })} className="mt-2 block w-full rounded-lg border border-line-2 bg-paper p-3 font-normal"><option value="legacy">Fleksibel · mengikuti aturan dan gaya pilihan</option><option value="vox">VOX · dokumenter dengan beat editorial</option><option value="stickman">Stickman · dokumenter 2D</option><option value="map">Map Animation · peta satelit 3D berkelanjutan</option></select></label><label className="block text-sm font-semibold">Prompt video<select aria-label="Mode prompt video" disabled={builtin} value={draft.videoMode} onChange={(e) => patch({ videoMode: e.target.value as 'scene' | 'universal' })} className="mt-2 block w-full rounded-lg border border-line-2 bg-paper p-3 font-normal"><option value="scene">Disesuaikan dengan setiap adegan</option><option value="universal">Universal · teks yang sama untuk setiap gambar</option></select><span className="mt-2 block text-xs font-normal text-muted">Mode universal memakai isi tab Video secara persis. Durasi sumber bisa berbeda dari potongan yang digunakan di editor.</span></label><label className="flex items-center gap-3 rounded-xl border border-line bg-paper p-4 text-sm"><input type="checkbox" disabled={builtin} checked={draft.lockedCamera} onChange={(e) => patch({ lockedCamera: e.target.checked })} />Kamera terkunci</label></div> : <><h3 className="text-base font-bold">{tab === 'source' ? 'Master prompt asli' : STAGES[tab].name}</h3><p className="mb-4 mt-1 text-xs leading-relaxed text-ink-2">{tab === 'source' ? 'Sumber aturan lengkap. Kolom per tahap menentukan arahan khusus yang dikirim saat produksi.' : STAGES[tab].hint}</p><textarea aria-label={tab === 'source' ? 'Teks asli master prompt' : `Aturan ${STAGES[tab].name}`} readOnly={builtin} rows={14} maxLength={tab === 'source' ? 100000 : 30000} value={tab === 'source' ? draft.sourceText : draft.stages[tab]} onChange={(e) => tab === 'source' ? patch({ sourceText: e.target.value }) : patch({ stages: { ...draft.stages, [tab]: e.target.value } })} placeholder="Tulis aturan khusus untuk tahap ini…" className="w-full resize-y rounded-xl border border-line bg-paper p-4 font-mono text-[12px] leading-[1.8] outline-none focus:border-accent" /></>}
              </div>
              <div className="flex items-center gap-2 border-t border-line bg-paper px-6 py-4">{!builtin && stored && <Button size="sm" variant="ghost" disabled={busy} icon={<Trash2 className="size-4" />} onClick={() => void remove()}>Hapus</Button>}<div className="flex-1" />{!builtin && <Button icon={<Save className="size-4" />} variant="primary" disabled={!dirty} loading={busy} onClick={() => void save()}>Simpan master</Button>}{back?.name === 'project' && <Button variant="ink" disabled={dirty || !stored || busy} icon={<Check className="size-4" />} onClick={() => void apply()}>Pakai di proyek ini</Button>}</div>
            </>}
            {error && <p role="alert" className="border-t border-bad-ink/20 bg-bad-soft px-6 py-4 text-sm text-bad-ink">{error}</p>}
          </section>
        </div>
      </div>
    </main>
  </div>
}
