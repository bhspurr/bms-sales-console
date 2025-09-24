// Script templates (same as v1; editable)
window.BMS_SCRIPTS = {
  meta: {
    stages: ['New Lead', 'Signed Up, No Start Date', 'Start Date Set', 'Onboarding Incomplete', 'Inactive', 'Active'],
    grades: ['Pre-K','K','1st','2nd','3rd','4th','5th'],
    personas: ['Teacher','Principal','Media Coordinator','District Admin']
  },
  templates: {
    'New Lead': {
      'Teacher': `Hey {{first_name}} — Ben from Build My Story.\nThanks for your interest. I see you're teaching {{grade_level}} with {{student_count}} students at {{school}}.\nQuick call to pick a start date? Lunch (12:30) or after school (4pm) your time works great.`,
      'Principal': `Hi {{first_name}}, Ben here from Build My Story.\nSaw your interest for {{school}}. We can start with one class and expand if you like. 10-minute chat to align?`,
      'Media Coordinator': `Hi {{first_name}} — Ben at Build My Story.\nWe can run the publishing session in the library in one or two 40-min blocks. Want a quick run-through?`,
      'District Admin': `Hi {{first_name}} — Ben from Build My Story.\nWe typically pilot with 2–3 teachers, then roll out. When's a good time to connect?`
    },
    'Signed Up, No Start Date': {
      'Teacher': `Hey {{first_name}} — Ben from Build My Story.\nYou signed up but haven’t picked a start date yet. Want me to lock a day during lunch or after school?`,
      'Principal': `Hi {{first_name}} — Ben here.\nYour team signed up. Shall we pick a kickoff week and I’ll send a one-pager for staff?`,
      'Media Coordinator': `Hi {{first_name}} — quick one: would you like printable flyers with your chosen date to send home?`,
      'District Admin': `Hi {{first_name}} — shall we set a start window for the pilot so schools can coordinate flyers and login cards?`
    },
    'Onboarding Incomplete': {
      'Teacher': `Hi {{first_name}} — looks like onboarding stopped at step 2. I can finish it for you: what date and class size should I use?`,
      'Principal': `Hi {{first_name}} — onboarding paused. Want me to complete setup for a model classroom so staff can see it in action?`,
      'Media Coordinator': `Hi {{first_name}} — we can preload the library schedule and grade levels. Want me to do that now?`,
      'District Admin': `Hi {{first_name}} — I can preconfigure schools, grades, and privacy settings; ready to proceed?`
    },
    'Inactive': {
      'Teacher': `Hi {{first_name}} — checking in. Do you want a fresh worksheet for your current topic? I can generate it and book a quick support call.`,
      'Principal': `Hi {{first_name}} — should we re-spark with a mini-competition? I can set up a 2-class challenge with rewards.`,
      'Media Coordinator': `Hi {{first_name}} — want me to batch-print student login cards and a poster for the library?`,
      'District Admin': `Hi {{first_name}} — proposal to relaunch with 3 schools, one showcase day, and a celebration event. Interested?`
    },
    'Active': {
      'Teacher': `Hi {{first_name}} — love the progress. Want advanced worksheets aligned to your next phonics pattern?`,
      'Principal': `Hi {{first_name}} — shall we schedule a student book celebration? I can handle logistics.`,
      'Media Coordinator': `Hi {{first_name}} — I can prep bulk print files with student names for next week.`,
      'District Admin': `Hi {{first_name}} — would you like a 1-page impact summary for your board?`
    },
    'Start Date Set': {
      'Teacher': `Hi {{first_name}} — great, your start date is set. I’ll send flyers and login cards. Anything special you need?`,
      'Principal': `Hi {{first_name}} — kickoff confirmed. I’ll share a staff-ready overview and timeline.`,
      'Media Coordinator': `Hi {{first_name}} — date locked. I can send print-ready worksheets with student names.`,
      'District Admin': `Hi {{first_name}} — pilot date locked. I’ll prepare metrics and parent comms templates.`
    }
  }
}
window.renderCallScript = function(stage, persona, ctx){
  const t = window.BMS_SCRIPTS.templates[stage]?.[persona] || 'Start the conversation.'
  return t.replace(/\{\{(\w+)\}\}/g, (_,k)=> ctx[k] ?? '')
}
