import {builtInMasterPrompts,resolveMasterPrompt} from '@shared/master-prompts'
import {useProject} from '../../store/project'
import {Button,confirmDialog} from '../../components/ui'
export function CutoutMasterUpgrade(){
 const {project,updateProject}=useProject();if(project?.styleId!=='cutout-facts')return null
 const current=resolveMasterPrompt(project),latest=builtInMasterPrompts.find(p=>p.id==='builtin:cutout-facts')!
 if(!current||current.version>=latest.version)return null
 const upgrade=async()=>{if(!await confirmDialog({title:'Gunakan master prompt v6?',body:'Arahan brief, naskah, visual dan produksi berikutnya memakai satu sumber v6. Naskah, gambar, suara dan pilihan caption tersimpan tidak diubah; tidak ada generate otomatis.',confirm:'Gunakan v6'}))return;updateProject({masterPrompt:structuredClone(latest)})}
 return <span className="inline-flex items-center gap-2 text-xs" data-cutout-master-upgrade><span>master prompt v{current.version}, tersedia v{latest.version}</span><Button size="sm" onClick={()=>void upgrade()}>Pilih v6</Button></span>
}
