// Saved planning directories retain archived records, as before DEC-101.
// Calendar's active-only projection remains separate. Never mutate input order.
export function directoryLessons(lessons,units,{unitId='',query=''}={}){
 const text=query.trim().toLocaleLowerCase();
 return lessons.filter(l=>(!unitId||l.unit_id===unitId)&&[l.title,units.find(u=>u.id===l.unit_id)?.title,l.planning_status].join(' ').toLocaleLowerCase().includes(text)).sort((a,b)=>(a.position??Infinity)-(b.position??Infinity)||String(a.id).localeCompare(String(b.id)));
}
