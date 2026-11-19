// The tour: the panel explained step by step, part by part, and where things stand (what works today, what waits).
// It opens by itself the first time each account signs in on this browser, and again from "جولة في اللوحة" in the
// menu. A step about a part the signed-in role cannot see is left out.
(() => {
  const UI = window.EH13_CRM_UI;
  if (!UI) return;
  const $ = (s, r = document) => r.querySelector(s);
  const wide = () => matchMedia('(min-width: 1024px)').matches;

  const STEPS = [
    {
      title: 'أهلاً في لوحة Escape Hub 13',
      text: 'دي اللوحة اللي الفريق كله هيشتغل عليها: الحجوزات، والعملاء، والفلوس، والرسايل. الجولة دي بتعرّفك على كل جزء، وبتقولك إيه اللي شغال دلوقتي وإيه اللي لسه مستني.',
    },
    {
      title: 'الوضع دلوقتي',
      text: `<b>اللوحة جاهزة كشكل وكطريقة شغل، بس لسه مش متوصلة بالـ database ولا بالموقع الحقيقي.</b>
        <ul><li>مفيش حجوزات حقيقية بتوصل هنا لسه.</li>
        <li>أي حاجة تعملها (حجز يدوي، تحصيل، تسجيل رحلة) بتشتغل قدامك، بس بتتمسح أول ما تقفل الصفحة.</li>
        <li>ولا رسالة واتساب بتتبعت، ولا فلوس بتتحرك.</li></ul>`,
    },
    {
      title: 'القايمة',
      text: 'كل الأقسام هنا. كل حساب بيشوف الأقسام المسموح له بيها بس: الاستقبال مثلاً بيشوف النهارده والوردية، والماركتير بيشوف الأرقام والحملات. الرقم الأحمر جنب القسم يعني فيه حاجة مستنياك.',
      target: '[data-nav]', drawer: true,
    },
    {
      title: 'النهارده: جدول الوردية',
      text: 'كل بيت ليه عمود، وكل ميعاد في اليوم صف. أول ما الموقع يتربط، <b>كل حجز من الموقع بينزل هنا لوحده</b>. الحجز اللي بييجي واتساب أو تليفون بيتعمل من «+ حجز يدوي» في الميعاد الفاضي، عشان الميعاد ما يتحجزش مرتين. وعلى كل رحلة: «وصلوا»، و«حصّل الباقي»، ولينك الإقرار.',
      route: 'today', target: '.board',
    },
    {
      title: 'أرقام الوردية',
      text: 'رحلات النهارده، واللاعبين الجايين، وكام واحد مضى الإقرار، والباقي اللي لسه هيتحصّل في المكان. وتحتهم «خلّي بالك»: تنبيهات من ملفات العملاء، زي عميل VIP جاي، أو عيد ميلاد، أو حد كان زعلان آخر مرة.',
      route: 'today', target: '.kpis',
    },
    {
      title: 'دوّر على أي حد',
      text: 'اكتب اسم أو رقم موبايل أو كود حجز (زي EH-7KQ2M)، وتوصل لملف العميل على طول.',
      target: '[data-find]', need: 'customers',
    },
    {
      title: 'العملاء',
      text: 'كل اللي حجز، و<b>كل لاعب مضى الإقرار</b>، ليه ملف بيتعمل لوحده: زياراته، والبيوت اللي لعبها، وصرف كام، ورأيه، والرسايل اللي راحت له. والشرايح فوق (رجعوا تاني، VIP، فاضلهم بيت، ما جوش من 90 يوم…) بتتحسب لوحدها.',
      route: 'customers', target: '.scroll-x', need: 'customers',
    },
    {
      title: 'سجل الرحلات',
      text: 'بعد كل رحلة، الـ Game Master بيسجّل من موبايله: هربوا ولا لأ، وفي كام دقيقة، وكام hint، وصورة الفريق، وأي حاجة حصلت جوه. ومن هنا بتطلع نسبة الهروب لكل بيت، وده رقم مكانش موجود قبل كده.',
      route: 'games', need: 'games',
    },
    {
      title: 'الوردية والخزنة',
      text: 'كل اللي اتحصّل في الوردية: كاش، ومحافظ، وInstaPay. وآخر الليل: تكتب الكاش اللي في الدرج، واللوحة تقولك مظبوط ولا فيه فرق، والتقفيل يوصل للمدير والأونر.',
      route: 'shift', need: 'shift',
    },
    {
      title: 'الرسايل والحملات',
      text: `رسايل الواتساب اللي بتتبعت لوحدها (تأكيد، وتذكير قبلها بيوم، و«إزاي كانت الرحلة؟»، وطلب تقييم جوجل…)، والحملات للشرايح، و«جماهير الإعلانات» للـ Meta وTikTok. التسويق بيروح بس للي وافق في الإقرار.<br><b>مستني:</b> ربط رقم الواتساب بالـ API، وموافقة Meta على القوالب.`,
      route: 'campaigns', target: '.seg', need: 'campaigns',
    },
    {
      title: 'الآراء والتقييمات',
      text: 'بعد الرحلة بساعتين بتروح رسالة «إزاي كانت الرحلة؟». اللي يدّي 4 أو 5 بيتطلب منه تقييم على جوجل ماب، واللي يدّي 3 أو أقل بيوصل للمدير يكلمه، وما بيتطلبش منه تقييم.',
      route: 'feedback', need: 'feedback',
    },
    {
      title: 'بيت ورا بيت',
      text: 'كارت الولاء: كل بيت يلعبه أي لاعب يتختم على كارته، واللي يكمّل التلاتة ياخد مكافأة، ولكل عميل كود يرشّح بيه صحابه.<br><b>مستني:</b> الأونر يحدد المكافآت.',
      route: 'loyalty', need: 'loyalty',
    },
    {
      title: 'الكروت والأكواد',
      text: 'كروت الهدايا (بتتباع وتتصرف ويتعرف رصيدها)، وأكواد الخصم للعروض والمؤثرين والمسابقات. كل كود بيقول جاب كام حجز ودخّل كام.',
      route: 'codes', need: 'codes',
    },
    {
      title: 'واتساب',
      text: 'صندوق محادثات الرقم جوه اللوحة. <b>ده شكل بس</b> لحد ما الأونر يقرر: يا الموظفين يردوا من هنا، يا الرد يفضل من الموبايل زي دلوقتي.',
      route: 'inbox', need: 'inbox',
    },
    {
      title: 'الحسابات',
      text: 'كل واحد بيدخل بحسابه، وكل حاجة بيعملها بتتسجل باسمه. هنا لستة الحسابات، وجدول «مين يعمل إيه» كامل. الأونر بس اللي يشيل حساب.',
      route: 'team', need: 'team',
    },
    {
      title: () => (UI.owner() ? 'الجولة والبيانات التجريبية' : 'الجولة'),
      text: () => `الجولة دي تتفتح تاني من «جولة في اللوحة».${UI.owner() ? '<br>وعندك كمان «املا ببيانات تجريبية»: بيملا اللوحة بعملاء ورحلات متألفين عشان تشوف الشكل وهو مليان، أو تعرضه على حد، و«امسح» بيرجعها فاضية. و«جرّب اللوحة بعين» بيوريك أي حساب بيشوف إيه.' : ''}`,
      target: '.side__tools', drawer: true,
    },
    {
      title: 'اللي فاضل عشان تشتغل بجد',
      text: `<ol><li>الأونر يوافق على الشاشات والصلاحيات.</li>
        <li>نربط اللوحة بالـ database (محرك الحجز متعمل ومتجرّب على الجهاز).</li>
        <li>حساب Paymob للدفع أونلاين.</li>
        <li>رقم الواتساب على الـ API، وتوثيق Meta.</li>
        <li>الدومين escapehub13.com، ونزول الموقع.</li>
        <li>الدخول الحقيقي بالتحقق بخطوتين، بدل الباسوردات دي.</li></ol>`,
    },
  ];

  let steps = [];
  let at = 0;
  let root = null;
  const pick = () => STEPS.filter((s) => !s.need || UI.sees(s.need));

  function build() {
    root = document.createElement('div');
    root.className = 'tour';
    root.innerHTML = `<div class="tour__dim"></div><div class="tour__spot"></div>
      <section class="tour__card" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <p class="tour__count"></p><h2 id="tour-title" class="tour__title"></h2><div class="tour__text"></div>
        <div class="tour__acts"><button class="btn btn--small" type="button" data-next></button><button class="btn btn--small btn--ghost" type="button" data-back>السابق</button><button class="tour__close" type="button" data-close>اقفل الجولة</button></div>
      </section>`;
    document.body.append(root);
    $('[data-next]', root).addEventListener('click', () => (at < steps.length - 1 ? show(at + 1) : close()));
    $('[data-back]', root).addEventListener('click', () => show(at - 1));
    $('[data-close]', root).addEventListener('click', close);
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft' && at < steps.length - 1) show(at + 1);
      else if (e.key === 'ArrowRight' && at > 0) show(at - 1);
    });
    addEventListener('resize', place);
  }

  function show(i) {
    at = i;
    const s = steps[i];
    if (s.route && location.hash.slice(2).split('?')[0] !== s.route) location.hash = `#/${s.route}`;
    $('.tour__count', root).textContent = `${i + 1} من ${steps.length}`;
    $('.tour__title', root).textContent = typeof s.title === 'function' ? s.title() : s.title;
    $('.tour__text', root).innerHTML = typeof s.text === 'function' ? s.text() : s.text;
    $('[data-next]', root).textContent = i === steps.length - 1 ? 'تمام، فهمت' : 'التالي';
    $('[data-back]', root).hidden = i === 0;
    // Let the screen change first, then light the part.
    setTimeout(() => {
      UI.drawer(!!s.drawer && !wide());
      const el = s.target ? $(s.target) : null;
      if (el && !el.closest('[hidden]')) el.scrollIntoView({ block: 'center' });
      else if (s.route) scrollTo(0, 0);
      setTimeout(place, 280);
      $('[data-next]', root).focus({ preventScroll: true });
    }, 120);
  }

  function place() {
    if (!root) return;
    const s = steps[at];
    const el = s.target ? $(s.target) : null;
    const spot = $('.tour__spot', root);
    const card = $('.tour__card', root);
    const r = el && !el.closest('[hidden]') ? el.getBoundingClientRect() : null;
    root.classList.toggle('tour--plain', !r || r.width === 0);
    card.style.top = '';
    card.style.bottom = '';
    if (!r || r.width === 0) return;
    const top = Math.max(8, r.top - 6);
    const bottom = Math.min(innerHeight - 8, r.bottom + 6);
    Object.assign(spot.style, { top: `${top}px`, left: `${Math.max(8, r.left - 6)}px`, width: `${Math.min(innerWidth - 16, r.width + 12)}px`, height: `${Math.max(24, bottom - top)}px` });
    // The card stays clear of the lit part: under it if there is room, else over it.
    const h = card.offsetHeight;
    if (!wide()) {
      if (innerHeight - bottom > h + 24) { card.style.top = `${bottom + 12}px`; card.style.bottom = 'auto'; }
      else if (top > h + 24) { card.style.top = `${Math.max(8, top - h - 12)}px`; card.style.bottom = 'auto'; }
    }
  }

  function open() {
    steps = pick();
    if (!root) build();
    root.hidden = false;
    document.documentElement.classList.add('touring');
    show(0);
  }
  function close() {
    if (!root) return;
    root.hidden = true;
    document.documentElement.classList.remove('touring');
    UI.drawer(false);
    try { localStorage.setItem(`eh13-tour-${UI.user()}`, '1'); } catch { /* fine */ }
    $('[data-tour-start]').focus();
  }

  document.querySelector('[data-tour-start]').addEventListener('click', open);
  const auto = () => {
    let seen = false;
    try { seen = localStorage.getItem(`eh13-tour-${UI.user()}`) === '1'; } catch { /* fine */ }
    if (!seen) setTimeout(open, 400);
  };
  if (UI.signedIn()) auto();
  document.addEventListener('eh13:open', auto);
})();
