/**
 * workerTranslations.js — Multilingual Translation Dictionary
 * Languages: English (en), Tamil (ta), Hindi (hi)
 */

export const WORKER_TRANSLATIONS = {
  en: {
    portalTitle: 'MCC FIX HUB',
    portalSubtitle: 'Worker Field Portal',
    selectWorker: 'Select Your Profile',
    activeWorker: 'Logged in as',
    langName: 'English',
    filterAll: 'All Assigned',
    filterActive: 'Active Tasks',
    filterCompleted: 'Completed / Verification',
    filterEscalated: 'Escalated / Blocked',
    noTicketsFound: 'No assigned tasks found for this status.',
    
    // Priority Badges
    priorityCritical: '🔴 CRITICAL',
    priorityHigh: '🟠 HIGH',
    priorityNormal: '🟡 NORMAL',
    priorityLow: '🟢 LOW',

    // Status Badges
    statusUnsolved: 'Assigned — Ready to Start',
    statusOngoing: '⚡ Work In Progress',
    statusAwaiting: '⏳ Awaiting User Confirmation',
    statusResolved: '✓ Resolved & Closed',
    statusReopened: '🔴 Reopened by User',
    statusBlocked: '⚠️ Cannot Complete — Admin Escalated',

    // Ticket Fields
    ticketNo: 'Ticket #',
    category: 'Category',
    location: 'Location',
    room: 'Room',
    complainant: 'Complainant',
    description: 'Complaint Description',
    listenBtn: '🔊 Listen to Complaint',
    speakingBtn: '🔊 Reading Complaint...',
    stopListenBtn: '⏹️ Stop Audio',

    // Workflow Buttons
    startWorkBtn: '▶ START WORK',
    workCompletedBtn: '✅ WORK COMPLETED',
    cannotCompleteBtn: '⚠️ CANNOT COMPLETE',
    workStartedAt: 'Started:',

    // Work Completed Modal
    completeModalTitle: 'Confirm Work Completed',
    completeModalSubtitle: 'This will notify the complainant to inspect and confirm the fix.',
    photoLabel: 'Attach Before / After Photo (Optional)',
    photoPlaceholder: 'Click to select or capture photo',
    noteLabel: 'Work Note / Action Taken (Optional)',
    notePlaceholder: 'Describe what was repaired...',
    voiceLabel: 'Voice Note (Optional)',
    recordVoice: '🎙️ Record Voice Note',
    stopRecord: '⏹️ Stop Recording',
    playVoice: '▶️ Play Recorded Voice',
    clearVoice: '🗑️ Clear Voice Note',
    submitComplete: 'SUBMIT WORK & NOTIFY USER',
    cancel: 'Cancel',

    // Cannot Complete Modal
    cannotModalTitle: 'Report Problem / Cannot Complete',
    cannotModalSubtitle: 'Escalate issue to Facilities Administrator for assistance.',
    selectReasonLabel: 'Select Primary Reason:',
    reasonSparePart: '🔧 Need Spare Part / Material',
    reasonSupervisor: '👤 Need Supervisor / Senior Assistance',
    reasonInaccessible: '🔒 Room / Location Locked or Inaccessible',
    reasonWrongIssue: '❓ Wrong Issue Category or Information',
    reasonMoreTime: '⏱️ Complex Repair — Need More Time',
    reasonOther: '📝 Other Technical Reason',
    escDetailsLabel: 'Additional Note for Admin (Required):',
    escDetailsPlaceholder: 'Explain clearly what is needed to complete this job...',
    submitEscalation: '🚨 ESCALATE TO ADMIN',

    // Notifications
    workStartedSuccess: 'Work started! Task updated to In Progress.',
    workCompletedSuccess: 'Work submitted! Complainant notified for verification.',
    cannotCompleteSuccess: 'Issue escalated to Administrator successfully.',
  },

  ta: {
    portalTitle: 'MCC ஃபிக்ஸ் ஹப்',
    portalSubtitle: 'பணியாளர் தளம் (Field Portal)',
    selectWorker: 'உங்கள் சுயவிவரத்தைத் தேர்ந்தெடுக்கவும்',
    activeWorker: 'உள்நுழைந்துள்ளவர்',
    langName: 'தமிழ்',
    filterAll: 'அனைத்து பணிகள்',
    filterActive: 'செயலில் உள்ளவை',
    filterCompleted: 'நிறைவடைந்தவை / சரிபார்ப்பு',
    filterEscalated: 'நிர்வாகிக்கு அனுப்பப்பட்டவை',
    noTicketsFound: 'இந்த நிலையில் பணிகள் எதுவும் இல்லை.',

    // Priority Badges
    priorityCritical: '🔴 அவசரம்',
    priorityHigh: '🟠 அதிக முன்னுரிமை',
    priorityNormal: '🟡 சாதாரண',
    priorityLow: '🟢 குறைந்த',

    // Status Badges
    statusUnsolved: 'ஒதுக்கப்பட்டது — தொடங்கத் தயார்',
    statusOngoing: '⚡ பணி நடைபெறுகிறது',
    statusAwaiting: '⏳ பயனர் உறுதிப்படுத்தலுக்குக் காத்திருக்கிறது',
    statusResolved: '✓ தீர்க்கப்பட்டது',
    statusReopened: '🔴 பயனரால் மீண்டும் திறக்கப்பட்டது',
    statusBlocked: '⚠️ முடிக்க இயலவில்லை — நிர்வாகிக்கு அனுப்பப்பட்டது',

    // Ticket Fields
    ticketNo: 'டிக்கெட் எண்ண',
    category: 'பிரிவு',
    location: 'இடம்',
    room: 'அறை',
    complainant: 'புகாரளித்தவர்',
    description: 'பிரச்சனை விளக்கம்',
    listenBtn: '🔊 புகாரைக் கேட்கவும்',
    speakingBtn: '🔊 புகாரைப் படிக்கிறது...',
    stopListenBtn: '⏹️ குரலை நிறுத்து',

    // Workflow Buttons
    startWorkBtn: '▶ பணியைத் தொடங்கு',
    workCompletedBtn: '✅ பணி நிறைவடைந்தது',
    cannotCompleteBtn: '⚠️ பணியை முடிக்க இயலவில்லை',
    workStartedAt: 'தொடங்கப்பட்டது:',

    // Work Completed Modal
    completeModalTitle: 'பணி நிறைவை உறுதிசெய்க',
    completeModalSubtitle: 'இது புகாரளித்தவருக்கு சரிபார்க்க அறிவிப்பு அனுப்பும்.',
    photoLabel: 'புகைப்படம் இணைக்கவும் (விருப்பம்)',
    photoPlaceholder: 'புகைப்படத்தைத் தேர்ந்தெடுக்கவும்',
    noteLabel: 'பணி குறிப்பு / செய்த வேலை (விருப்பம்)',
    notePlaceholder: 'என்ன பழுதுபார்க்கப்பட்டது என்பதை விவரிக்கவும்...',
    voiceLabel: 'குரல் குறிப்பு (விருப்பம்)',
    recordVoice: '🎙️ குரல் பதிவு செய்',
    stopRecord: '⏹️ பதிவை நிறுத்து',
    playVoice: '▶️ குரலை ஒலிக்கச் செய்',
    clearVoice: '🗑️ குரலை நீக்கு',
    submitComplete: 'சமர்ப்பித்து பயனருக்கு அனுப்புக',
    cancel: 'ரத்து செய்',

    // Cannot Complete Modal
    cannotModalTitle: 'பணியை முடிக்க இயலாமையை அறிக்கையிடுக',
    cannotModalSubtitle: 'உதவிக்காக பராமரிப்பு நிர்வாகியிடம் அனுப்பவும்.',
    selectReasonLabel: 'முக்கிய காரணத்தைத் தேர்ந்தெடுக்கவும்:',
    reasonSparePart: '🔧 உதிரி பாகம் / பொருள் தேவை',
    reasonSupervisor: '👤 மேற்பார்வையாளர் / மூத்த அதிகாரி தேவை',
    reasonInaccessible: '🔒 அறை பூட்டப்பட்டுள்ளது / செல்ல முடியாது',
    reasonWrongIssue: '❓ தவறான பிரச்சனை விவரம்',
    reasonMoreTime: '⏱️ கூடுதல் நேரம் தேவை',
    reasonOther: '📝 வேறு தொழில்நுட்ப காரணம்',
    escDetailsLabel: 'நிர்வாகிக்கான கூடுதல் விவரம் (அவசியம்):',
    escDetailsPlaceholder: 'வேலையை முடிக்க என்ன தேவை என்பதை தெளிவாக விவரிக்கவும்...',
    submitEscalation: '🚨 நிர்வாகிக்கு அனுப்புக',

    // Notifications
    workStartedSuccess: 'பணி தொடங்கப்பட்டது!',
    workCompletedSuccess: 'பணி சமர்ப்பிக்கப்பட்டது! பயனருக்கு அறிவிப்பு அனுப்பப்பட்டது.',
    cannotCompleteSuccess: 'பிரச்சனை நிர்வாகிக்கு வெற்றிகரமாக அனுப்பப்பட்டது.',
  },

  hi: {
    portalTitle: 'MCC फिक्स हब',
    portalSubtitle: 'कार्यकर्ता फील्ड पोर्टल',
    selectWorker: 'अपनी प्रोफ़ाइल चुनें',
    activeWorker: 'लॉग इन हैं',
    langName: 'हिंदी',
    filterAll: 'सभी कार्य',
    filterActive: 'सक्रिय कार्य',
    filterCompleted: 'पूर्ण / सत्यापन',
    filterEscalated: 'प्रशासक को भेजा गया',
    noTicketsFound: 'इस स्थिति में कोई कार्य नहीं मिला।',

    // Priority Badges
    priorityCritical: '🔴 गंभीर',
    priorityHigh: '🟠 उच्च',
    priorityNormal: '🟡 सामान्य',
    priorityLow: '🟢 निम्न',

    // Status Badges
    statusUnsolved: 'आवंटित — शुरू करने के लिए तैयार',
    statusOngoing: '⚡ कार्य प्रगति पर है',
    statusAwaiting: '⏳ उपयोगकर्ता की पुष्टि की प्रतीक्षा है',
    statusResolved: '✓ हल और बंद',
    statusReopened: '🔴 उपयोगकर्ता द्वारा पुनः खोला गया',
    statusBlocked: '⚠️ कार्य पूरा नहीं हो सकता — प्रशासक को भेजा गया',

    // Ticket Fields
    ticketNo: 'टिकट संख्या',
    category: 'श्रेणी',
    location: 'स्थान',
    room: 'कमरा',
    complainant: 'शिकायतकर्ता',
    description: 'शिकायत का विवरण',
    listenBtn: '🔊 शिकायत सुनें',
    speakingBtn: '🔊 शिकायत पढ़ी जा रही है...',
    stopListenBtn: '⏹️ आवाज रोकें',

    // Workflow Buttons
    startWorkBtn: '▶ कार्य शुरू करें',
    workCompletedBtn: '✅ कार्य पूरा हुआ',
    cannotCompleteBtn: '⚠️ कार्य पूरा नहीं कर सकते',
    workStartedAt: 'प्रारंभ समय:',

    // Work Completed Modal
    completeModalTitle: 'कार्य पूरा होने की पुष्टि करें',
    completeModalSubtitle: 'यह शिकायतकर्ता को निरीक्षण और पुष्टि करने के लिए सूचित करेगा।',
    photoLabel: 'फोटो संलग्न करें (वैकल्पिक)',
    photoPlaceholder: 'फोटो चुनने के लिए क्लिक करें',
    noteLabel: 'कार्य नोट / की गई मरम्मत (वैकल्पिक)',
    notePlaceholder: 'बताएं कि क्या मरम्मत की गई...',
    voiceLabel: 'वॉयस नोट (वैकल्पिक)',
    recordVoice: '🎙️ वॉयस नोट रिकॉर्ड करें',
    stopRecord: '⏹️ रिकॉर्डिंग रोकें',
    playVoice: '▶️ वॉयस नोट चलाएं',
    clearVoice: '🗑️ वॉयस नोट हटाएँ',
    submitComplete: 'सबमिट करें और उपयोगकर्ता को भेजें',
    cancel: 'रद्द करें',

    // Cannot Complete Modal
    cannotModalTitle: 'समस्या की रिपोर्ट करें / कार्य पूरा नहीं कर सकते',
    cannotModalSubtitle: 'सहायता के लिए सुविधा प्रशासक को भेजें।',
    selectReasonLabel: 'मुख्य कारण चुनें:',
    reasonSparePart: '🔧 स्पेयर पार्ट / सामग्री की आवश्यकता है',
    reasonSupervisor: '👤 पर्यवेक्षक / वरिष्ठ की आवश्यकता है',
    reasonInaccessible: '🔒 कमरा / स्थान बंद या अगम्य है',
    reasonWrongIssue: '❓ गलत समस्या श्रेणी या विवरण',
    reasonMoreTime: '⏱️ जटिल मरम्मत — अधिक समय चाहिए',
    reasonOther: '📝 अन्य तकनीकी कारण',
    escDetailsLabel: 'प्रशासक के लिए अतिरिक्त विवरण (आवश्यक):',
    escDetailsPlaceholder: 'स्पष्ट रूप से बताएं कि कार्य पूरा करने के लिए क्या चाहिए...',
    submitEscalation: '🚨 प्रशासक को भेजें',

    // Notifications
    workStartedSuccess: 'कार्य शुरू हुआ! स्थिति प्रगति पर अपडेट की गई।',
    workCompletedSuccess: 'कार्य जमा किया गया! उपयोगकर्ता को सत्यापन के लिए सूचित किया गया।',
    cannotCompleteSuccess: 'समस्या प्रशासक को सफलतापूर्वक भेजी गई।',
  }
};
