/**
 * DataDash HCI pilot — Google Apps Script web endpoint.
 * 1. Run setupSpreadsheet once in the Apps Script editor (grants authorization).
 * 2. Deploy as Web app: Execute as Me; Access: Anyone (for anonymous participants).
 * 3. Paste the /exec deployment URL into index.html SHEET_URL.
 * Do not put participant names, email addresses, or other identifying details in this sheet.
 */
const DD = {
  spreadsheetKey: 'DATADASH_SPREADSHEET_ID',
  sheets: {
    participants: ['participant_id','condition','task_order','age_range','dashboard_experience','ai_use_frequency','chart_creation_experience','software_learning_confidence','session_started','training_completed','session_completed','save_status'],
    tasks: ['participant_id','condition','task_order','task_position','task','task_name','correct','steps_correct','steps_total','time_seconds','help_requests','revision_requests','followups','confidence','uncertainty','explanation_clarity','perceived_control','mental_demand','clarity_not_used','control_not_used','session_started'],
    feedback: ['participant_id','condition','most_helpful','most_confusing','could_get_explanation','suggested_change','revision_helped'],
    events: ['participant_id','condition','event_time','event_type','event_details_json']
  },
  names: {participants:'Participants',tasks:'Task Results',feedback:'Final Feedback',events:'Event Log'}
};

/** Creates a NEW Google Spreadsheet, including all headers. Run exactly once manually. */
function setupSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty(DD.spreadsheetKey);
  if (existing) throw new Error('Already configured. Spreadsheet: https://docs.google.com/spreadsheets/d/'+existing+'/edit');
  const ss = SpreadsheetApp.create('DataDash HCI Pilot Study — Responses');
  const first = ss.getSheets()[0];
  first.setName(DD.names.participants);
  Object.keys(DD.sheets).forEach(k => {
    const sheet = k==='participants' ? first : ss.insertSheet(DD.names[k]);
    const headers = DD.sheets[k];
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#e7edf6');
    sheet.setFrozenRows(1);
  });
  props.setProperty(DD.spreadsheetKey, ss.getId());
  Logger.log('New study spreadsheet: '+ss.getUrl());
  return ss.getUrl();
}

function doGet() { return out_({ok:true,message:'DataDash study collection endpoint ready'}); }
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('Missing request body');
    const body = JSON.parse(e.postData.contents);
    if (body.action !== 'start' && body.action !== 'finish') throw new Error('Unknown action');
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      return out_(body.action === 'start' ? start_(body) : finish_(body));
    } finally { lock.releaseLock(); }
  } catch(err) {
    console.error(err);
    return out_({ok:false,error:String(err.message || err)});
  }
}
function out_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty(DD.spreadsheetKey);
  if (!id) throw new Error('Run setupSpreadsheet() first');
  return SpreadsheetApp.openById(id);
}
function sheet_(ss, k) { const s=ss.getSheetByName(DD.names[k]); if(!s) throw new Error('Missing tab: '+DD.names[k]); return s; }
function rows_(sheet) { return sheet.getLastRow() < 2 ? [] : sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues(); }
function findParticipant_(sheet,pid) {
  const values=rows_(sheet);
  for(let i=0;i<values.length;i++) if(String(values[i][0])===pid) return {row:i+2,values:values[i]};
  return null;
}
function start_() {
  const ss=ss_(), p=sheet_(ss,'participants');
  const all=rows_(p), arms=[['one-directional','AB'],['one-directional','BA'],['revisable','AB'],['revisable','BA']];
  // Counterbalance across all allocated study IDs; ties break randomly.
  const counts=arms.map(a=>all.filter(r=>r[1]===a[0]&&r[2]===a[1]).length);
  const least=Math.min.apply(null,counts);
  const eligible=counts.map((v,i)=>v===least?i:-1).filter(v=>v>=0);
  const arm=arms[eligible[Math.floor(Math.random()*eligible.length)]];
  const pid='DD-'+Utilities.getUuid();
  const now=new Date().toISOString();
  p.appendRow([pid,arm[0],arm[1],'','','','','',now,0,'','allocated']);
  return {ok:true,pid:pid,cond:arm[0],order:arm[1]};
}
function safe_(value) {
  if(value === undefined || value === null) return '';
  if(typeof value === 'object') value=JSON.stringify(value);
  if(typeof value === 'boolean') return value ? 1 : 0;
  if(typeof value === 'number') return Number.isFinite(value)?value:'';
  const str=String(value).slice(0,45000);
  return /^[\s]*[=+\-@]/.test(str)? "'"+str : str; // prevent spreadsheet formula injection
}
function columns_(keys,obj){ return keys.map(k=>safe_(obj[k])); }
function replaceRowsForPid_(sheet,pid,values) {
  // Replace rows for this participant on retry so partial writes cannot duplicate records.
  for(let r=sheet.getLastRow();r>=2;r--) {
    if(String(sheet.getRange(r,1).getValue())===pid) sheet.deleteRow(r);
  }
  if(values.length){
    const offset=sheet.getLastRow()+1;
    sheet.getRange(offset,1,values.length,values[0].length).setValues(values);
  }
}
function finish_(body) {
  const pid=String(body.pid||'');
  if(!/^DD-[0-9a-f-]{36}$/i.test(pid)) throw new Error('Invalid participant ID');
  const ss=ss_(), participants=sheet_(ss,'participants');
  const person=findParticipant_(participants,pid);
  if(!person) throw new Error('Participant ID not allocated by this server');
  if(String(person.values[11])==='complete') return {ok:true,already_saved:true};
  const cond=String(person.values[1]), order=String(person.values[2]);
  const taskRows=body.rows;
  if(!Array.isArray(taskRows)||taskRows.length!==2) throw new Error('Expected two completed task records');
  const seen=taskRows.map(r=>r.task);
  if(seen.sort().join('')!=='AB') throw new Error('Expected Tasks A and B');
  if(taskRows.some(r=>String(r.participant_id)!==pid || String(r.condition)!==cond || Number(r.task_position)<1 || Number(r.task_position)>2)) throw new Error('Mismatched task data');
  const originalOrder=taskRows.slice().sort((a,b)=>a.task_position-b.task_position).map(x=>x.task).join('');
  if(originalOrder!==order) throw new Error('Task order mismatch');
  const background=body.background||{}, feedback=body.interview||{};
  const events=Array.isArray(body.events)?body.events:[];
  if(events.length>5000) throw new Error('Too many events');
  if(events.some(x=>x.pid!==pid || x.condition!==cond)) throw new Error('Event participant mismatch');
  const tasks=sheet_(ss,'tasks'), f=sheet_(ss,'feedback'), ev=sheet_(ss,'events');
  replaceRowsForPid_(tasks,pid,taskRows.map(r=>columns_(DD.sheets.tasks,r)));
  replaceRowsForPid_(f,pid,[columns_(DD.sheets.feedback,{
    participant_id:pid,condition:cond,most_helpful:feedback.most_helpful,
    most_confusing:feedback.most_confusing,could_get_explanation:feedback.could_get_explanation,
    suggested_change:feedback.suggested_change,revision_helped:feedback.revision_helped
  })]);
  replaceRowsForPid_(ev,pid,events.map(e=>columns_(DD.sheets.events,{
    participant_id:pid,condition:cond,event_time:e.t,event_type:e.type,
    event_details_json:e
  })));
  const trainingComplete=events.some(e=>e.type==='training_complete' || e.type==='training_end' || e.type==='training_success');
  const record={
    age_range:background.age_range,dashboard_experience:background.dashboard_experience,
    ai_use_frequency:background.ai_use_frequency,chart_creation_experience:background.chart_creation_experience,
    software_learning_confidence:background.software_learning_confidence,
    session_started:person.values[8],training_completed:trainingComplete?1:0,
    session_completed:new Date().toISOString(),save_status:'complete'
  };
  const cols=DD.sheets.participants;
  const old=person.values;
  const updated=cols.map((key,i)=>safe_(key==='participant_id'?pid:key==='condition'?cond:key==='task_order'?order:key in record?record[key]:old[i]));
  participants.getRange(person.row,1,1,cols.length).setValues([updated]);
  SpreadsheetApp.flush();
  return {ok:true,saved_tasks:taskRows.length,saved_events:events.length};
}
