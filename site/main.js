// Language and theme toggles. Vietnamese is written in the HTML; English comes from here.
(function () {
  var en = {
    'nav.features': 'Features',
    'nav.how': 'How it works',
    'nav.privacy': 'Privacy',
    'nav.setup': 'Setup',
    'cta.download': 'Download free',
    'cta.try': 'Try it in 5 minutes',
    'cta.github': 'View on GitHub',
    'hero.pill': 'Open source · runs on your machine',
    'hero.title1': 'Your inbox, sorted.',
    'hero.title2': 'You just reply.',
    'hero.lead': 'Inbox Assistant reads your Gmail for you: files every email into the right category, sums it up in one sentence and tells you which ones need you. Want to reply? Just say so — the AI drafts it right in the chat.',
    'mock.categories': 'Categories',
    'cat.work': 'Work',
    'cat.school': 'School',
    'cat.finance': 'Finance',
    'cat.news': 'Newsletters',
    'cat.notify': 'Notifications',
    'cat.personal': 'Personal',
    'mock.new5': '5 new',
    'mock.new3': '3 new',
    'mock.new1': '1 new',
    'mock.new12': '12 new',
    'mock.new7': '7 new',
    'mock.new2': '2 new',
    'mock.draftIntro': 'I drafted your reply to Linh — have a look:',
    'mock.to': 'To',
    'mock.subject': 'Re: Kick-off confirmation',
    'mock.body': 'Hi Linh, confirming I’ll join the kick-off on Friday at 3 pm. I’ll send the slides by Wednesday evening…',
    'mock.polite': 'Polite',
    'mock.shorter': 'Shorter',
    'mock.send': 'Send',
    'mock.toast': '4 emails need you today',
    'mock.toastSub': '1 deadline · 1 security alert',
    'strip.1': 'Gmail over IMAP · no Google Cloud project',
    'strip.2': 'OpenAI or a local model (Ollama)',
    'strip.3': 'Your data stays in SQLite on your machine',
    'features.eyebrow': 'Features',
    'features.title': 'Three things it does for you every morning.',
    'f1.title': 'Files every email',
    'f1.body': 'Each new email is read once, filed into categories you define, given a priority and its to-dos pulled out. Move one email by hand and future ones from that sender follow.',
    'f1.r1': 'Landing page design quote',
    'f1.r2': 'October account statement',
    'f1.r3': 'Semester exam schedule',
    'f2.title': 'Ask your inbox like a person',
    'f2.body': '“Who is waiting for my reply this week?” — the assistant searches, reads and answers from your real emails, with cards you can click to open.',
    'f2.q': 'Which bills are still unpaid?',
    'f2.tool': '→ search · Finance · needs you',
    'f2.a': 'One: the October electricity bill, due Nov 5.',
    'f3.title': 'Reply right there',
    'f3.body': 'One-tap reply ideas under every email, or jot the gist and let AI write it out. Edit the draft in place and hit send when you’re happy.',
    'f3.c1': 'Accept 3 pm',
    'f3.c2': 'Ask to move to 4:30',
    'f3.c3': '✦ Write with AI',
    'how.eyebrow': 'How it works',
    'how.title': 'Imports your inbox once. After that, only new mail.',
    'how.s1': 'STEP 1',
    'how.s2': 'STEP 2',
    'how.s3': 'STEP 3',
    'how.s4': 'STEP 4',
    'how.t1': 'Snapshot the inbox',
    'how.p1': 'Only message IDs and read flags — a few bytes per email.',
    'how.t2': 'Fetch what’s new',
    'how.p2': 'Downloads only emails it doesn’t have yet, 25 at a time.',
    'how.t3': 'Mirror changes',
    'how.p3': 'Read, starred, archived or deleted elsewhere — it follows along.',
    'how.t4': 'AI reads once',
    'how.p4': 'One AI call per email: category, priority, deadline, to-dos and a one-line summary.',
    'keys.eyebrow': 'Keyboard first',
    'keys.title': 'Clear your inbox without touching the mouse.',
    'keys.body': 'Move, archive, reply, call the assistant — everything has a shortcut. Press ⌘K to find anything.',
    'keys.k1': 'Next / previous',
    'keys.k2': 'Archive',
    'keys.k3': 'Reply',
    'keys.k4': 'Ask the assistant',
    'keys.k5': 'Command menu',
    'keys.k6': 'Send',
    'privacy.eyebrow': 'Privacy',
    'privacy.title': 'Your mail stays on your machine.',
    'privacy.t1': 'No server in between',
    'privacy.p1': 'The app runs on localhost and talks to Gmail directly. Everything lives in one SQLite file — delete it and it’s gone.',
    'privacy.t2': 'You pick the AI',
    'privacy.p2': 'Use OpenAI, or point it at a local model like Ollama so no email ever leaves your computer.',
    'privacy.t3': 'AI never sends',
    'privacy.p3': 'Everything the AI writes is a draft. Only you can press Send.',
    'setup.title': 'Up and running in five minutes.',
    'setup.body': 'You need Node.js 18+, a Gmail App Password and an OpenAI API key. No database or cloud account to set up.',
    'setup.cta': 'Full guide on GitHub',
    'setup.comment': '# fill in GMAIL_ADDRESS, GMAIL_APP_PASSWORD, OPENAI_API_KEY',
    'setup.ready': '✓ Ready on http://localhost:3000',
    'footer.by': 'Inbox Assistant · made by',
    'footer.source': 'Open source on GitHub',
  };

  var nodes = document.querySelectorAll('[data-i18n]');
  var vi = {};
  nodes.forEach(function (el) {
    vi[el.dataset.i18n] = el.textContent;
  });
  var titles = { vi: document.title, en: 'Inbox Assistant — your Gmail, sorted by AI' };

  function setLang(lang) {
    var dict = lang === 'en' ? en : vi;
    nodes.forEach(function (el) {
      var text = dict[el.dataset.i18n];
      if (text) el.textContent = text;
    });
    document.documentElement.lang = lang;
    document.title = titles[lang];
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
    try {
      localStorage.setItem('lang', lang);
    } catch (e) {}
  }

  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      setLang(b.dataset.lang);
    });
  });

  var saved = null;
  try {
    saved = localStorage.getItem('lang');
  } catch (e) {}
  var initial = saved || ((navigator.language || '').toLowerCase().indexOf('vi') === 0 ? 'vi' : 'en');
  if (initial !== 'vi') setLang(initial);

  document.getElementById('theme').addEventListener('click', function () {
    var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch (e) {}
  });
})();
