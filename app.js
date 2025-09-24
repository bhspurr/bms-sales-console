// Sales Console v2
const cfgUrl = './config.json'
let CFG = null
let currentDeal = null, currentPerson=null, currentOrg=null
let DEAL_FIELDS = {} // id->label map, and label->key map
let ALL_DEALS_CACHE = [] // for filters
let page=0, pageSize=40, lastSearch=''

const el = (id)=>document.getElementById(id)

// ---- Load config ----
async function loadConfig(){
  const res = await fetch(cfgUrl)
  if(!res.ok) throw new Error('Missing config.json — copy config.sample.json and set your Pipedrive token.')
  CFG = await res.json()
}

// ---- API helpers ----
function qs(path){ return path.includes('?') ? '&' : '?' }
async function pd(path, opts={}){
  const url = `${CFG.pipedriveBase}${path}${qs(path)}api_token=${CFG.pipedriveToken}`
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) } })
  if(!res.ok){ throw new Error('Pipedrive error: '+res.status) }
  return await res.json()
}

// Map deal fields for human labels
async function loadDealFields(){
  const data = await pd('/dealFields')
  DEAL_FIELDS = { byKey:{}, byLabel:{} }
  for(const f of data.data || []){
    DEAL_FIELDS.byKey[f.key] = f
    DEAL_FIELDS.byLabel[(f.name||'').toLowerCase()] = f
  }
}

// Resolve Start Date field
function resolveStartDateKey(){
  if(CFG.startDateFieldKey){ return CFG.startDateFieldKey }
  if(CFG.startDateFieldLabel){
    const f = DEAL_FIELDS.byLabel[CFG.startDateFieldLabel.toLowerCase()]
    if(f) return f.key
  }
  const guess = DEAL_FIELDS.byLabel['start date'] || DEAL_FIELDS.byLabel['start_date']
  return guess ? guess.key : null
}

// ---- Core deal fetchers ----
async function getDeal(dealId){ const d = await pd(`/deals/${dealId}?include_products=0`); return d.data }
async function getPerson(personId){ const p = await pd(`/persons/${personId}`); return p.data }
async function getOrg(orgId){ const o = await pd(`/organizations/${orgId}`); return o.data }

async function findByEmail(email){
  const persons = await pd(`/persons/search?term=${encodeURIComponent(email)}&fields=email&exact_match=true`)
  const personItem = persons?.data?.items?.[0]; let personId = personItem?.item?.id
  let deal = null
  if(personId){
    const deals = await pd(`/deals?person_id=${personId}&status=all_not_deleted`)
    deal = deals?.data?.[0] || null
  }
  if(!deal){
    const items = await pd(`/itemSearch?term=${encodeURIComponent(email)}&item_types=deal,person`)
    const firstDeal = items?.data?.items?.find(i=>i.item?.type==='deal')?.item
    if(firstDeal){ deal = await getDeal(firstDeal.id) }
    if(!personId){ personId = items?.data?.items?.find(i=>i.item?.type==='person')?.item?.id || null }
  }
  return {deal, personId}
}

// Pull a page of deals
async function listDeals(pg=0, search=''){
  const start = pg*pageSize
  // Pipedrive /deals accepts start & limit
  const add = search ? `&term=${encodeURIComponent(search)}&title=${encodeURIComponent(search)}` : ''
  const res = await pd(`/deals?status=open&start=${start}&limit=${pageSize}${add}`)
  return res.data || []
}

// ---- UI renderers ----
function renderKV(target, obj){
  target.innerHTML=''
  for(const [k,v] of Object.entries(obj)){ 
    const kEl=document.createElement('div'); kEl.className='muted'; kEl.textContent=k
    const vEl=document.createElement('div'); vEl.textContent=v ?? ''
    target.appendChild(kEl); target.appendChild(vEl)
  }
}
function renderAllFields(target, deal){
  target.innerHTML=''
  if(!deal) return
  const flat = {...deal}
  // include custom_fields keys too
  if (deal.custom_fields){
    for(const [k,v] of Object.entries(deal.custom_fields)){ flat[k]=v }
  }
  for(const [key,val] of Object.entries(flat)){
    if(['id','creator_user_id','user_id','org_id','person_id','stage_id','status','title','value','currency','add_time','update_time'].includes(key)) continue
    let label = DEAL_FIELDS.byKey[key]?.name || key
    const v = (typeof val === 'object' ? JSON.stringify(val) : (val ?? ''))
    const kEl=document.createElement('div'); kEl.className='muted'; kEl.textContent=label
    const vEl=document.createElement('div'); vEl.textContent=v
    target.appendChild(kEl); target.appendChild(vEl)
  }
}

function formatZ(dt){ return new Date(dt).toLocaleString(undefined, { hour12:false }) }

function computeWindows(tz){
  const locale = tz || CFG.defaultFallbackTZ || 'America/New_York'
  const nowTZ = new Date(new Date().toLocaleString('en-US', { timeZone: locale }))
  const lunch = new Date(nowTZ); lunch.setHours(12,30,0,0); if(lunch<=nowTZ) lunch.setDate(lunch.getDate()+1)
  const after = new Date(nowTZ); after.setHours(16,0,0,0); if(after<=nowTZ) after.setDate(after.getDate()+1)
  // skip weekends
  function nextBiz(d){ const day=d.getDay(); if(day===6){d.setDate(d.getDate()+2)} if(day===0){d.setDate(d.getDate()+1)} }
  nextBiz(lunch); nextBiz(after)
  const toUK=(d)=> new Date(d.toLocaleString('en-GB',{timeZone:'Europe/London'})).toLocaleString('en-GB',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'})
  return { tz: locale, lunch:lunch.toISOString(), after:after.toISOString(), lunch_uk_display: toUK(lunch), after_uk_display: toUK(after) }
}

function renderWindows(target, w){
  target.innerHTML = `
    <div>Local TZ: <b>${w.tz}</b></div>
    <div>Lunch (12:30 local): <b>${formatZ(w.lunch)}</b> — UK: <b>${w.lunch_uk_display}</b></div>
    <div>After-school (16:00 local): <b>${formatZ(w.after)}</b> — UK: <b>${w.after_uk_display}</b></div>
  `
}

function populateControls(meta){
  const s=el('stageSelect'), g=el('gradeSelect'), p=el('personaSelect')
  s.innerHTML=''; g.innerHTML=''; p.innerHTML=''
  meta.stages.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;s.appendChild(o)})
  meta.grades.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;g.appendChild(o)})
  meta.personas.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;p.appendChild(o)})
}

function renderScript(){
  const stage = el('stageSelect').value
  const grade = el('gradeSelect').value
  const persona = el('personaSelect').value
  const ctx = {
    first_name: currentPerson?.first_name || currentDeal?.person_name?.split(' ')?.[0] || 'there',
    grade_level: grade || currentDeal?.['grade_level'] || currentDeal?.custom_fields?.['grade_level'] || '',
    student_count: currentDeal?.['student_count'] || currentDeal?.custom_fields?.['student_count'] || '',
    school: currentOrg?.name || '',
    stage, persona
  }
  const script = window.renderCallScript(stage, persona, ctx)
  el('scriptOutput').textContent = script
}

// ---- Actions ----
async function createActivity(payload){ return (await pd(`/activities`, {method:'POST', body: JSON.stringify(payload)})).data }
async function createNote(payload){ return (await pd(`/notes`, {method:'POST', body: JSON.stringify(payload)})).data }

async function scheduleCallActivity(subject, isoWhen){
  if(!currentDeal) return
  const noteText = el('notes').value || ''
  const payload = {
    subject, done:0, type:'call',
    deal_id: currentDeal.id, person_id: currentPerson?.id, org_id: currentOrg?.id,
    due_date: isoWhen.slice(0,10), due_time: isoWhen.slice(11,16),
    note: noteText
  }
  try{ await createActivity(payload); el('saveResult').textContent='✅ Call scheduled in Pipedrive' }
  catch(e){ el('saveResult').textContent='❌ Failed to schedule — check token/permissions' }
}
async function saveNote(){
  if(!currentDeal) return
  const text = `[${el('disposition').value}]\n\n` + (el('notes').value || '')
  const payload = { content:text, deal_id: currentDeal.id, person_id: currentPerson?.id, org_id: currentOrg?.id }
  try{ await createNote(payload); el('saveResult').textContent='✅ Note saved to Pipedrive' }
  catch(e){ el('saveResult').textContent='❌ Failed to save note — check token/permissions' }
}

function updateSyncTime(){ el('lastSync').textContent = 'Last sync: ' + new Date().toLocaleTimeString() }

// ---- Load a specific lead ----
async function loadLead(){
  el('saveResult').textContent=''
  const q = el('dealIdInput').value.trim()
  if(!q) return
  let deal=null, personId=null
  if(/@/.test(q)){
    ({deal, personId} = await findByEmail(q))
  } else {
    deal = await getDeal(q)
    personId = deal?.person_id?.value || null
  }
  currentDeal = deal
  currentPerson = personId ? await getPerson(personId) : (deal?.person_id?.value ? await getPerson(deal.person_id.value) : null)
  currentOrg = deal?.org_id?.value ? await getOrg(deal.org_id.value) : null

  const tz = currentPerson?.custom_fields?.tz || currentOrg?.custom_fields?.tz || CFG.defaultFallbackTZ
  const windows = computeWindows(tz)

  renderKV(el('leadOverview'), {
    'Name': deal?.person_name || (currentPerson?.name || ''),
    'Email': currentPerson?.email?.[0]?.value || '',
    'Phone': currentPerson?.phone?.[0]?.value || '',
    'School': currentOrg?.name || '',
    'Stage ID': deal?.stage_id || '',
    'Title': deal?.title || ''
  })
  renderAllFields(el('allFields'), deal)
  renderWindows(el('callWindows'), windows)

  // call link
  const tel=(currentPerson?.phone?.[0]?.value || '').replace(/[^0-9+]/g,'')
  el('telLink').href = tel ? `tel:${tel}` : '#'

  populateControls(CFG.scriptMeta)
  renderScript()
  el('stageSelect').onchange = renderScript
  el('gradeSelect').onchange = renderScript
  el('personaSelect').onchange = renderScript

  el('scheduleLunch').onclick = ()=> scheduleCallActivity('Lunch Call', windows.lunch)
  el('scheduleAfter').onclick = ()=> scheduleCallActivity('After-school Call', windows.after)

  updateSyncTime()
}

// ---- Sidebar: queue & browse ----
function bucketByStartDate(deal){
  const key = resolveStartDateKey()
  const raw = key ? (deal[key] ?? deal.custom_fields?.[key]) : null
  if(!raw) return 'all'
  const d = new Date(raw)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate()+1)
  const startOfNextWeek = new Date(startOfToday); startOfNextWeek.setDate(startOfNextWeek.getDate()+7)
  if(d < startOfToday) return 'past'
  if(d >= startOfToday && d < startOfTomorrow) return 'today'
  if(d >= startOfTomorrow && d < startOfToday.setDate(startOfToday.getDate()+2)) return 'tomorrow' // +2 because we already advanced
  // Reset today again (since we mutated it)
}
function bucketByStartDateSafe(deal){
  const key = resolveStartDateKey()
  const raw = key ? (deal[key] ?? deal.custom_fields?.[key]) : null
  if(!raw) return 'all'
  const d = new Date(raw)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1)
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate()+7)
  if(d < today) return 'past'
  if(d >= today && d < tomorrow) return 'today'
  if(d >= tomorrow && d < new Date(today.getFullYear(),today.getMonth(),today.getDate()+2)) return 'tomorrow'
  if(d >= today && d <= weekEnd) return 'week'
  return 'all'
}

function drawCounts(){
  const counts = {today:0,tomorrow:0,week:0,past:0,all:ALL_DEALS_CACHE.length}
  for(const d of ALL_DEALS_CACHE){
    counts[bucketByStartDateSafe(d)] ||= 0
    counts[bucketByStartDateSafe(d)]++
  }
  el('count-today').textContent = counts.today
  el('count-tomorrow').textContent = counts.tomorrow
  el('count-week').textContent = counts.week
  el('count-past').textContent = counts.past
  el('count-all').textContent = counts.all
}

function renderDealList(deals){
  const box = el('dealList'); box.innerHTML=''
  deals.forEach(d=>{
    const div=document.createElement('div'); div.className='deal-item'
    const sdKey = resolveStartDateKey(); const startVal = sdKey ? (d[sdKey] || d.custom_fields?.[sdKey] || '') : ''
    div.innerHTML = `<b>${d.title || '(no title)'}</b><br><span class="muted small">Start: ${startVal || '-'}</span>`
    div.onclick = async ()=>{
      el('dealIdInput').value = d.id
      await loadLead()
    }
    box.appendChild(div)
  })
}

async function refreshDeals(){
  // pull one page for browse; for counts, optionally pull more — for now, pull 2 pages (80)
  const d1 = await listDeals(page, lastSearch)
  const d2 = await listDeals(page+1, lastSearch)
  ALL_DEALS_CACHE = [...d1, ...d2]
  drawCounts()
  renderDealList(d1)
  el('pageInfo').textContent = `Page ${page+1}`
  updateSyncTime()
}

function setupSidebar(){
  document.querySelectorAll('.filter-btn').forEach(btn=>{
    btn.onclick = ()=>{
      const type = btn.dataset.filter
      const list = ALL_DEALS_CACHE.filter(d=> type==='all' ? true : bucketByStartDateSafe(d)===type )
      renderDealList(list.slice(0,pageSize))
    }
  })
  el('dealSearch').oninput = (e)=>{ lastSearch = e.target.value.trim(); page=0; refreshDeals() }
  el('prevPage').onclick = ()=>{ if(page>0){ page--; refreshDeals() } }
  el('nextPage').onclick = ()=>{ page++; refreshDeals() }
}

// ---- Boot ----
async function boot(){
  await loadConfig()
  await loadDealFields()
  setupSidebar()
  populateControls(CFG.scriptMeta)
  // wire buttons
  el('loadBtn').onclick = loadLead
  el('refreshBtn').onclick = ()=>{ refreshDeals() }
  el('saveNote').onclick = saveNote
  // Deep link
  const params = new URLSearchParams(location.search)
  const q = params.get('dealId') || params.get('email')
  if(q){ el('dealIdInput').value = q }
  await refreshDeals()
  setInterval(refreshDeals, 60000) // auto-refresh every minute
}
document.addEventListener('DOMContentLoaded', boot)
