export interface AssetLicenseManifest {source:string;url:string;license:string;attribution:string;author:string;downloadedAt:string;sha256:string;retrievedAt?:string}
const licenses=['CC0','PUBLIC-DOMAIN','CC-BY-4.0','CC-BY-3.0','CC-BY-SA-4.0','CC-BY-SA-3.0','PIXABAY','MIXKIT','ORIGINAL']
/** A local import records user-supplied provenance; it cannot independently prove ownership. */
export function validateLicenseManifest(raw:unknown,internetImage=false):AssetLicenseManifest {
 if(!raw||typeof raw!=='object')throw Error('Manifest lisensi belum tersedia.')
 const m=raw as AssetLicenseManifest;for(const k of ['source','url','license','attribution','author','downloadedAt','sha256'] as const)if(typeof m[k]!=='string'||!m[k].trim()||m[k].length>4000)throw Error('Manifest lisensi: '+k+' wajib diisi.')
 if(!licenses.includes(m.license)||!/^[a-f0-9]{64}$/i.test(m.sha256)||!Number.isFinite(Date.parse(m.downloadedAt)))throw Error('Lisensi, tanggal atau SHA-256 manifest tidak valid.')
 if(m.source==='original'){if(m.license!=='ORIGINAL')throw Error('Karya sendiri harus memakai lisensi ORIGINAL.')}else{try{if(new URL(m.url).protocol!=='https:')throw Error()}catch{throw Error('URL sumber harus HTTPS.')}}
 if(internetImage&&(!m.retrievedAt||!Number.isFinite(Date.parse(m.retrievedAt))||!['CC0','PUBLIC-DOMAIN','CC-BY-4.0','CC-BY-3.0','CC-BY-SA-4.0','CC-BY-SA-3.0'].includes(m.license)))throw Error('Gambar internet memerlukan tanggal pengambilan dan lisensi terbuka yang didukung.')
 return {...m}
}
export function licenseAttribution(m:AssetLicenseManifest):string{return `${m.attribution}\n${m.author} — ${m.license}\n${m.url}${m.license.includes('SA')?'\nShareAlike: penuhi kewajiban lisensi turunan sebelum publikasi.':''}`}
