import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ClipboardList,
  FileText,
  KeyRound,
  LayoutGrid,
  LockKeyhole,
  MessageSquare,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  Users2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import triCordLogo from '../assets/tricord-logo.png';

export function MarketingHome({ appUrl }: { appUrl: string }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.documentElement.classList.add('marketing-page');
    document.body.classList.add('marketing-page');
    const meta = ensureMetaDescription();
    const previousDescription = meta.getAttribute('content') ?? '';
    document.title = 'TriCord | One workspace for conversations, projects, and team operations';
    meta.setAttribute('content', 'TriCord helps small businesses and startup teams keep client work, projects, SOPs, tasks, and team operations organized in one focused workspace.');
    return () => {
      document.title = previousTitle;
      document.documentElement.classList.remove('marketing-page');
      document.body.classList.remove('marketing-page');
      meta.setAttribute('content', previousDescription);
    };
  }, []);

  const launchApp = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    window.history.pushState({}, '', appUrl);
    window.dispatchEvent(new Event('tricord:navigate'));
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const marketingBasePath = getMarketingBasePath(appUrl);
  const marketingPage = getMarketingPage(marketingBasePath);

  if (marketingPage !== 'home') {
    return (
      <div className="min-h-screen bg-[#F7F5F2] text-[#17151D] antialiased">
        <MarketingHeader appUrl={appUrl} marketingBasePath={marketingBasePath} onLaunch={launchApp} />
        <main><LegalPage page={marketingPage} appUrl={appUrl} homeUrl={marketingBasePath || '/'} onLaunch={launchApp} /></main>
        <MarketingFooter appUrl={appUrl} marketingBasePath={marketingBasePath} onLaunch={launchApp} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#17151D] antialiased">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold">Skip to content</a>
      <MarketingHeader appUrl={appUrl} marketingBasePath={marketingBasePath} onLaunch={launchApp} />
      <main id="main">
        <Hero appUrl={appUrl} onLaunch={launchApp} />
        <OutcomeStrip />
        <OperatingSection />
        <FeatureHighlights />
        <ProductTour appUrl={appUrl} onLaunch={launchApp} />
        <ProductRhythm appUrl={appUrl} onLaunch={launchApp} />
        <WorkflowTimeline />
        <ComparisonSection />
        <UseCases />
        <Testimonials />
        <Pricing appUrl={appUrl} onLaunch={launchApp} />
        <Security />
        <FAQ />
        <FinalCTA appUrl={appUrl} onLaunch={launchApp} />
      </main>
      <MarketingFooter appUrl={appUrl} marketingBasePath={marketingBasePath} onLaunch={launchApp} />
    </div>
  );
}

function MarketingHeader({ appUrl, marketingBasePath, onLaunch }: { appUrl: string; marketingBasePath: string; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const homeHref = marketingBasePath || '/';
  const sectionHref = (id: string) => joinMarketingPath(marketingBasePath, `#${id}`);
  return (
    <header className="sticky top-0 z-40 border-b border-[#E5DED4]/80 bg-[#FFFDF9]/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href={homeHref} className="flex items-center gap-3" aria-label="TriCord home"><BrandMark /><span className="text-xl font-extrabold">TriCord</span></a>
        <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-semibold text-[#5F5668] lg:flex">
          <a className="hover:text-[#17151D]" href={sectionHref('features')}>Features</a>
          <a className="hover:text-[#17151D]" href={sectionHref('tour')}>Tour</a>
          <a className="hover:text-[#17151D]" href={sectionHref('workflow')}>Workflow</a>
          <a className="hover:text-[#17151D]" href={sectionHref('pricing')}>Pricing</a>
          <a className="hover:text-[#17151D]" href={sectionHref('security')}>Security</a>
        </nav>
        <div className="flex items-center gap-2">
          <a href={appUrl} onClick={onLaunch} className="hidden rounded-lg px-4 py-2 text-sm font-bold text-[#5F5668] hover:text-[#17151D] sm:inline-flex">Sign in</a>
          <a href={appUrl} onClick={onLaunch} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#17151D] px-4 text-sm font-bold text-white shadow-lg shadow-[#17151D]/20 transition hover:-translate-y-0.5 hover:bg-[#2A2432]">Start Free</a>
        </div>
      </div>
    </header>
  );
}

function Hero({ appUrl, onLaunch }: { appUrl: string; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <section id="top" className="relative isolate overflow-hidden border-b border-[#E5DED4] bg-[#141118] text-white">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(249,115,22,0.24),transparent_30rem),radial-gradient(circle_at_74%_18%,rgba(253,186,116,0.14),transparent_24rem),linear-gradient(135deg,#141118_0%,#211A27_52%,#121016_100%)]" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#F7F5F2] to-transparent opacity-10" />
      <div className="relative z-10 mx-auto grid min-h-[760px] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-5 inline-flex rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm font-bold text-[#FFD7B0] shadow-lg shadow-black/20 backdrop-blur">Built for busy teams that need fewer loose ends</p>
          <h1 className="text-5xl font-black leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">Run client work, projects, & team operations from one hub.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/74 sm:text-xl">TriCord gives small businesses and startups one place to discuss work, assign follow-ups, save procedures, and manage everyday operations without chasing updates across separate tools.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <MarketingButton href={appUrl} onClick={onLaunch}>Start Free <ArrowRight className="h-4 w-4" /></MarketingButton>
            <a href="#tour" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/16 bg-white/8 px-5 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/14">Explore Interactive Tour <ChevronRight className="h-4 w-4" /></a>
          </div>
          <div className="mt-10 grid max-w-3xl gap-4 text-sm text-white/68 sm:grid-cols-3">
            <Metric value="One hub" label="for work, tasks, and records" />
            <Metric value="Clear owners" label="for every next step" />
            <Metric value="Less chasing" label="across chat and spreadsheets" />
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
          <div className="absolute -left-6 top-12 z-20 hidden rounded-2xl border border-white/14 bg-[#17151D]/92 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:block">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFEDD5] text-[#C2410C]"><Bell className="h-5 w-5" /></span><div><p className="text-sm font-black">3 active discussions</p><p className="text-xs text-[#D8D2DE]">Client launch room</p></div></div>
          </div>
          <div className="absolute -right-4 top-28 z-20 hidden rounded-2xl border border-white/14 bg-[#17151D]/92 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl md:block">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#FDBA74]">Assigned</p><p className="mt-1 text-sm font-black">Taylor owns final review</p><p className="mt-1 text-xs text-[#D8D2DE]">Due Friday</p>
          </div>
          <div className="absolute -bottom-7 left-12 z-20 hidden rounded-2xl border border-white/14 bg-[#17151D]/92 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl md:block">
            <div className="flex -space-x-2">{['A','J','S','M'].map((initial) => <span key={initial} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-[#F97316] text-xs font-black text-[#431407]">{initial}</span>)}</div><p className="mt-3 text-xs text-[#D8D2DE]">Team members online</p>
          </div>
          <HeroAppMockup />
        </div>
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <p><strong className="block text-2xl text-white">{value}</strong>{label}</p>;
}

function HeroAppMockup() {
  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-white/14 bg-[#F7F5F2] p-3 shadow-[0_34px_90px_rgba(0,0,0,0.42)]">
      <div className="flex items-center gap-2 border-b border-[#E5DED4] px-3 py-2"><span className="h-3 w-3 rounded-full bg-[#F97316]" /><span className="h-3 w-3 rounded-full bg-[#FDBA74]" /><span className="h-3 w-3 rounded-full bg-[#0D9488]" /><span className="ml-auto text-xs font-bold text-[#7A7183]">NorthPeak Hub</span></div>
      <div className="grid min-h-[460px] grid-cols-[150px_minmax(0,1fr)] bg-[#FFFDF9] text-[#17151D]">
        <aside className="border-r border-[#E5DED4] bg-[#F3EEE7] p-4">
          <div className="mb-6 flex items-center gap-2"><BrandMark small /><strong>TriCord</strong></div>
          {['Active Feed', 'Tasks', 'Knowledge', 'Files', 'Reports'].map((item, index) => <div key={item} className={cn('mb-2 rounded-lg px-3 py-2 text-xs font-black', index === 0 ? 'bg-[#FFEDD5] text-[#C2410C]' : 'text-[#6B6274]')}>{item}</div>)}
        </aside>
        <main className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8C8495]">Hub</p><h3 className="text-2xl font-black">Acme Studio</h3></div><button className="rounded-lg bg-[#17151D] px-3 py-2 text-xs font-black text-white">New post</button></div>
          <div className="grid gap-3 sm:grid-cols-3">{[['Open posts','18'],['Knowledge','12'],['Open tasks','7']].map(([label, value]) => <div key={label} className="rounded-xl border border-[#E5DED4] bg-white p-4"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8C8495]">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}</div>
          <div className="mt-4 rounded-xl border border-[#F97316]/40 bg-[#FFF8EF] p-4 shadow-sm"><div className="flex gap-2"><span className="rounded-full bg-[#DBEAFE] px-2 py-1 text-[10px] font-black text-[#2563EB]">Active</span><span className="rounded-full bg-[#CCFBF1] px-2 py-1 text-[10px] font-black text-[#0F766E]">Client onboarding</span></div><h4 className="mt-3 text-lg font-black">Prepare launch checklist before Monday kickoff</h4><p className="mt-2 text-sm leading-6 text-[#6B6274]">Jamie attached the draft SOP. Morgan owns final review and Taylor is updating the task board.</p><div className="mt-4 flex items-center gap-3"><AvatarDot initial="J" /><strong className="text-sm">Jamie</strong><span className="text-xs text-[#8C8495]">12 min ago</span></div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2"><MiniTask title="Review access list" person="Morgan" /><MiniTask title="Publish welcome guide" person="Taylor" /></div>
        </main>
      </div>
    </div>
  );
}

function MiniTask({ title, person }: { title: string; person: string }) {
  return <div className="rounded-xl border border-[#E5DED4] bg-white p-4"><p className="text-xs font-black text-[#C2410C]">In progress</p><h5 className="mt-2 font-black">{title}</h5><p className="mt-2 text-xs text-[#7A7183]">Assigned to {person}</p></div>;
}

function OutcomeStrip() {
  const outcomes = [
    ["Fewer missed follow-ups", "Turn scattered messages into clear posts with owners and next steps."],
    ["Faster team handoffs", "Keep files, decisions, and task context together so work moves without repeated explanations."],
    ["Cleaner operations", "Organize client work, SOPs, files, task ownership, and reports in one shared hub."],
    ["Room to grow", "Start simple, then add structure as your team, clients, and processes expand."],
  ];

  return (
    <section className="border-b border-[#E5DED4] bg-white py-10">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {outcomes.map(([title, body]) => (
          <article key={title} className="rounded-2xl border border-[#E5DED4] bg-[#FFFDF9] p-5 shadow-sm">
            <p className="text-sm font-black text-[#17151D]">{title}</p>
            <p className="mt-2 text-sm leading-6 text-[#635B6C]">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function OperatingSection() {
  return (
    <MarketingSection eyebrow="Built for lean teams" title="Give every update a clear home, owner, and next step." body="Small teams move fast, but speed breaks down when client requests, internal tasks, SOPs, and people records live in different places. TriCord gives your team a simple operating rhythm without enterprise-level complexity.">
      <div className="grid gap-4 md:grid-cols-3">
        {benefits.map(({ icon: Icon, title, body }) => <article key={title} className="rounded-2xl border border-[#E5DED4] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFEDD5] text-[#C2410C]"><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-3 leading-7 text-[#635B6C]">{body}</p></article>)}
      </div>
    </MarketingSection>
  );
}

const benefits = [
  { icon: MessageSquare, title: 'Client work stays organized', body: 'Keep every client request, update, file, and reply attached to the work it belongs to.' },
  { icon: ClipboardList, title: 'Projects keep moving', body: 'Turn conversations into assigned tasks with priorities, due dates, and status your team can see.' },
  { icon: BriefcaseBusiness, title: 'Operations feel manageable', body: 'See tasks, procedures, files, reports, and follow-through without rebuilding spreadsheets.' },
];

const features = [
  { icon: MessageSquare, title: 'Discussions', body: 'Focused posts keep every decision, reply, file, and follow-up attached to the original work.', preview: 'discussion' },
  { icon: LayoutGrid, title: 'Tasks', body: 'Board, list, and calendar views help your team move from conversation to completed work.', preview: 'tasks' },
  { icon: FileText, title: 'Knowledge Base', body: 'SOPs, FAQs, guides, and repeatable processes become easy for the team to find and follow.', preview: 'knowledge' },
  { icon: Clock3, title: 'Optional Business Modules', body: 'Turn on attendance, employee records, and payroll-preparation records only when your Hub needs them.', preview: 'workforce' },
  { icon: ShieldCheck, title: 'Access Control', body: 'Owners, Admins, Members, and Guests see only what their role needs.', preview: 'security' },
  { icon: Sparkles, title: 'Reports', body: 'See tasks, activity, room progress, and optional business-module records in one view.', preview: 'reports' },
] as const;

function FeatureHighlights() {
  return (
    <section id="features" className="border-y border-[#E5DED4] bg-[#FFFDF9] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl"><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">Feature highlights</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-normal sm:text-5xl">Everything important stays connected to the work.</h2><p className="mt-5 text-lg leading-8 text-[#635B6C]">TriCord blends the familiarity of team chat with the structure business owners need to run projects, shared knowledge, and repeatable processes.</p></div>
          <div className="rounded-2xl border border-[#E5DED4] bg-white p-4 text-sm font-semibold text-[#635B6C] shadow-sm">Built for daily operations, not extra admin work.</div>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {features.map((feature) => <div key={feature.title}><FeatureCard icon={feature.icon} title={feature.title} body={feature.body} preview={feature.preview} /></div>)}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon: Icon, title, body, preview }: { icon: LucideIcon; title: string; body: string; preview: string }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-[#E5DED4] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="h-40 border-b border-[#E5DED4] bg-[#F7F5F2] p-4"><MiniPreview kind={preview} /></div>
      <div className="p-6"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFEDD5] text-[#C2410C]"><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-3 leading-7 text-[#635B6C]">{body}</p></div>
    </article>
  );
}

function MiniPreview({ kind }: { kind: string }) {
  if (kind === 'tasks') return <div className="grid h-full grid-cols-3 gap-2">{['To do','Doing','Done'].map((label, index) => <div key={label} className="rounded-xl border border-[#E5DED4] bg-white p-2"><p className="text-[10px] font-black text-[#8C8495]">{label}</p><div className={cn('mt-3 h-14 rounded-lg', index === 0 ? 'bg-[#FFEDD5]' : index === 1 ? 'bg-[#DBEAFE]' : 'bg-[#CCFBF1]')} /></div>)}</div>;
  if (kind === 'knowledge') return <div className="space-y-2">{['Client launch SOP','Weekly report FAQ','Escalation guide'].map((item) => <div key={item} className="rounded-lg border border-[#E5DED4] bg-white px-3 py-2 text-xs font-bold text-[#5F5668]"><FileText className="mr-2 inline h-3.5 w-3.5 text-[#F97316]" />{item}</div>)}</div>;
  if (kind === 'workforce') return <div className="grid h-full grid-cols-[1fr_1.3fr] gap-3"><div className="rounded-xl bg-white p-3"><AvatarDot initial="A" /><p className="mt-3 text-xs font-black">Alex</p><p className="text-[10px] text-[#8C8495]">Clocked in</p></div><div className="rounded-xl border border-[#E5DED4] bg-white p-3"><p className="text-[10px] font-black text-[#8C8495]">Today</p><div className="mt-3 h-3 rounded bg-[#F97316]" /><div className="mt-2 h-3 w-2/3 rounded bg-[#FDBA74]" /></div></div>;
  if (kind === 'security') return <div className="grid h-full place-items-center"><div className="rounded-2xl border border-[#E5DED4] bg-white p-5 text-center"><LockKeyhole className="mx-auto h-8 w-8 text-[#C2410C]" /><p className="mt-3 text-sm font-black">Role-safe access</p></div></div>;
  if (kind === 'reports') return <div className="flex h-full items-end gap-2 rounded-xl border border-[#E5DED4] bg-white p-4">{[44,78,52,92,68].map((height, index) => <div key={index} className="flex-1 rounded-t-lg bg-[#F97316]" style={{ height: `${height}%`, opacity: 0.55 + index * 0.08 }} />)}</div>;
  return <div className="space-y-3"><div className="rounded-xl border border-[#F97316]/35 bg-white p-3"><p className="text-xs font-black">Launch checklist</p><p className="mt-1 text-[10px] text-[#8C8495]">4 replies · 2 tasks</p></div><div className="ml-8 rounded-xl border border-[#E5DED4] bg-white p-3 text-xs text-[#635B6C]">Jamie added the client notes.</div></div>;
}

function ProductTour({ appUrl, onLaunch }: { appUrl: string; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const [step, setStep] = useState(0);
  const steps = tourSteps;
  const active = steps[step];
  return (
    <section id="tour" className="bg-[#17151D] py-20 text-white sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center"><p className="text-sm font-black uppercase tracking-[0.22em] text-[#FDBA74]">Interactive product tour</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-normal sm:text-5xl">From request to completed work without losing context.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/70">Click through a simple workflow your team can use every day: capture the request, discuss the details, assign the work, track progress, and close the loop.</p></div>
        <div className="mt-12 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">{steps.map((item, index) => <button key={item.title} type="button" onClick={() => setStep(index)} className={cn('group w-full rounded-2xl border p-4 text-left transition', step === index ? 'border-[#F97316] bg-[#F97316] text-[#431407] shadow-xl shadow-[#F97316]/20' : 'border-white/10 bg-white/7 text-white hover:bg-white/10')}><div className="flex items-center gap-3"><span className={cn('grid h-9 w-9 place-items-center rounded-xl text-sm font-black', step === index ? 'bg-[#431407] text-[#FDBA74]' : 'bg-white/10 text-[#FDBA74]')}>{index + 1}</span><div><p className="font-black">{item.title}</p><p className={cn('mt-1 text-xs leading-5', step === index ? 'text-[#5B1B06]' : 'text-white/55')}>{item.body}</p></div></div></button>)}</div>
          <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/8 p-4 shadow-2xl shadow-black/30">
            <MousePointer2 className="absolute left-[18%] top-[18%] z-20 h-7 w-7 rotate-[-14deg] animate-pulse text-[#FDBA74] drop-shadow" />
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-[#0C0B10] p-4 lg:grid-cols-[180px_minmax(0,1fr)]">
              <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="mb-5 flex items-center gap-2"><BrandMark small /><strong>TriCord</strong></div>{['Active Feed','Tasks','Knowledge','Reports'].map((item, index) => <div key={item} className={cn('mb-2 rounded-lg px-3 py-2 text-xs font-black', index === active.nav ? 'bg-[#F97316] text-[#431407]' : 'text-white/50')}>{item}</div>)}</aside>
              <div className="min-h-[430px] rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Hub</p><h3 className="text-2xl font-black">{active.screenTitle}</h3></div><span className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black">{active.action}</span></div><TourScreen step={step} /></div>
            </div>
          </div>
        </div>
        <div className="mt-10 text-center"><MarketingButton href={appUrl} onClick={onLaunch}>Try the workflow <ArrowRight className="h-4 w-4" /></MarketingButton></div>
      </div>
    </section>
  );
}

const tourSteps = [
  { title: 'Create Post', body: 'Start with one clear topic.', screenTitle: 'Client Launch', action: 'New post', nav: 0 },
  { title: 'Discussion', body: 'Keep replies in context.', screenTitle: 'Client Launch', action: 'Reply', nav: 0 },
  { title: 'Assign Task', body: 'Give the next step an owner.', screenTitle: 'Project Board', action: 'Add task', nav: 1 },
  { title: 'Track Progress', body: 'See what moved and what is stuck.', screenTitle: 'Project Board', action: 'Update', nav: 1 },
  { title: 'Done', body: 'Keep the outcome searchable.', screenTitle: 'Knowledge Base', action: 'Save note', nav: 2 },
];

function TourScreen({ step }: { step: number }) {
  if (step === 2 || step === 3) return <div className="grid gap-3 md:grid-cols-3">{['To do','In progress','Done'].map((column, index) => <div key={column} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-xs font-black text-white/50">{column}</p><div className={cn('mt-4 rounded-xl border p-3', index === (step === 2 ? 0 : 1) ? 'border-[#F97316] bg-[#F97316]/14' : 'border-white/10 bg-[#17151D]')}><span className="rounded-full bg-[#FFEDD5] px-2 py-1 text-[10px] font-black text-[#C2410C]">High</span><h4 className="mt-3 font-black">Review launch checklist</h4><p className="mt-2 text-xs text-white/55">Assigned to Morgan · Due Friday</p></div></div>)}</div>;
  if (step === 4) return <div className="rounded-2xl border border-white/10 bg-[#17151D] p-5"><span className="rounded-full bg-[#CCFBF1] px-2 py-1 text-xs font-black text-[#0F766E]">Published</span><h4 className="mt-4 text-2xl font-black">Client launch SOP</h4><p className="mt-3 max-w-xl leading-7 text-white/62">The final checklist, owner notes, and handoff steps are now saved so the next launch starts faster.</p><div className="mt-5 grid gap-2 sm:grid-cols-3">{['Checklist','Screenshots','Handoff notes'].map((item) => <div key={item} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm font-bold">{item}</div>)}</div></div>;
  return <div className="space-y-4"><div className="rounded-2xl border border-[#F97316]/50 bg-[#17151D] p-5"><span className="rounded-full bg-[#DBEAFE] px-2 py-1 text-xs font-black text-[#2563EB]">Active</span><h4 className="mt-4 text-2xl font-black">Prepare client launch checklist</h4><p className="mt-3 leading-7 text-white/62">Alex opened the post, Jamie added the requirements, and Taylor attached the first checklist draft.</p></div>{step === 1 && <div className="ml-8 rounded-2xl border border-white/10 bg-white/[0.05] p-4"><strong>Jamie</strong><p className="mt-2 text-sm leading-6 text-white/62">I added the client requirements. Morgan can review the access section before Friday.</p></div>}</div>;
}

function ProductRhythm({ appUrl, onLaunch }: { appUrl: string; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <section className="bg-[#F7F5F2] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl space-y-20 px-4 sm:px-6 lg:px-8">
        <ProductBand eyebrow="Focused collaboration" title="A calmer feed for work that needs context." body="Every post has a purpose: make a decision, share an update, collect files, or move work forward. Replies stay attached to the topic so people do not have to search through noise." reverse={false}><FeedMockup /></ProductBand>
        <ProductBand eyebrow="Project execution" title="Tasks inherit the context that created them." body="Turn discussion into clear ownership with board, list, and calendar views. Leaders can scan what is open, assigned, overdue, or completed without another status meeting." reverse><TaskMockup /></ProductBand>
        <ProductBand eyebrow="Optional business modules" title="Add operational records only when your team needs them." body="Attendance tracking, employee records, and payroll-preparation records can be enabled by the Hub Owner when those workflows belong in TriCord. Core collaboration stays simple by default." reverse={false}><WorkforceMockup /></ProductBand>
        <div className="text-center"><MarketingButton href={appUrl} onClick={onLaunch}>Start Free <ArrowRight className="h-4 w-4" /></MarketingButton></div>
      </div>
    </section>
  );
}

function ProductBand({ eyebrow, title, body, reverse, children }: { eyebrow: string; title: string; body: string; reverse?: boolean; children: ReactNode }) {
  return <div className={cn('grid items-center gap-10 lg:grid-cols-2', reverse && 'lg:[&>*:first-child]:order-2')}><div>{children}</div><div><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">{eyebrow}</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-normal sm:text-5xl">{title}</h2><p className="mt-5 text-lg leading-8 text-[#635B6C]">{body}</p><div className="mt-8 grid gap-3 text-sm font-semibold text-[#5F5668] sm:grid-cols-2"><p><Check className="mr-2 inline h-4 w-4 text-[#0D9488]" />Fast to understand</p><p><Check className="mr-2 inline h-4 w-4 text-[#0D9488]" />Built for repeated use</p></div></div></div>;
}

function FeedMockup() { return <MockupShell title="Active Feed"><div className="space-y-3">{['Weekly client update','Launch approvals','Support escalation'].map((item, index) => <div key={item} className="rounded-xl border border-[#E5DED4] bg-white p-4"><div className="flex gap-2"><span className="rounded-full bg-[#DBEAFE] px-2 py-1 text-[10px] font-black text-[#2563EB]">Active</span><span className="rounded-full bg-[#CCFBF1] px-2 py-1 text-[10px] font-black text-[#0F766E]">Room</span></div><h4 className="mt-3 font-black">{item}</h4><p className="mt-2 text-sm text-[#7A7183]">{index + 2} replies · {index + 1} task</p></div>)}</div></MockupShell>; }
function TaskMockup() { return <MockupShell title="Tasks"><div className="grid gap-3 md:grid-cols-3">{['To do','In progress','Done'].map((item, index) => <div key={item} className="rounded-xl border border-[#E5DED4] bg-white p-3"><p className="text-xs font-black text-[#8C8495]">{item}</p><div className={cn('mt-4 rounded-lg p-3', index === 0 ? 'bg-[#FFEDD5]' : index === 1 ? 'bg-[#DBEAFE]' : 'bg-[#CCFBF1]')}><p className="text-sm font-black">{['Prepare packet','Review list','Send summary'][index]}</p><p className="mt-2 text-xs text-[#5F5668]">{['Sam','Jordan','Casey'][index]}</p></div></div>)}</div></MockupShell>; }
function WorkforceMockup() { return <MockupShell title="Business Modules"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#E5DED4] bg-white p-4"><p className="text-xs font-black text-[#8C8495]">Attendance</p><div className="mt-4 h-3 rounded bg-[#F97316]" /><div className="mt-2 h-3 w-2/3 rounded bg-[#FDBA74]" /></div><div className="rounded-xl border border-[#E5DED4] bg-white p-4"><p className="text-xs font-black text-[#8C8495]">Leave approvals</p><p className="mt-4 text-2xl font-black">4</p><p className="text-xs text-[#7A7183]">pending requests</p></div><div className="rounded-xl border border-[#E5DED4] bg-white p-4 sm:col-span-2"><p className="text-xs font-black text-[#8C8495]">Payroll preparation</p><p className="mt-3 text-sm text-[#635B6C]">Payment methods, recurring items, and compensation notes stay organized per employee for owner review.</p></div></div></MockupShell>; }

function MockupShell({ title, children }: { title: string; children: ReactNode }) {
  return <div className="overflow-hidden rounded-3xl border border-[#E5DED4] bg-white p-4 shadow-2xl shadow-[#C2410C]/8"><div className="mb-4 flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#F97316]" /><span className="h-3 w-3 rounded-full bg-[#FDBA74]" /><span className="h-3 w-3 rounded-full bg-[#0D9488]" /><span className="ml-auto text-sm font-black">{title}</span></div><div className="rounded-2xl bg-[#F7F5F2] p-4">{children}</div></div>;
}

function WorkflowTimeline() {
  const steps = [
    { icon: MessageSquare, title: 'Collect the request', body: 'Start with a focused post that captures the outcome, context, and room.' },
    { icon: Users2, title: 'Discuss with the right people', body: 'Keep replies, files, and decisions attached to the work instead of scattered.' },
    { icon: ClipboardList, title: 'Assign the next step', body: 'Give every action a person, priority, and date so ownership is visible.' },
    { icon: CheckCircle2, title: 'Close the loop', body: 'Archive the work, save the process, and report what changed.' },
  ];
  return <section id="workflow" className="border-y border-[#E5DED4] bg-white py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mx-auto max-w-3xl text-center"><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">Workflow</p><h2 className="mt-4 text-4xl font-black tracking-normal sm:text-5xl">A clear operating rhythm for every team.</h2></div><div className="relative mt-12 grid gap-5 lg:grid-cols-4"><div className="absolute left-0 right-0 top-10 hidden h-px bg-[#E5DED4] lg:block" />{steps.map(({ icon: Icon, title, body }, index) => <article key={title} className="relative rounded-2xl border border-[#E5DED4] bg-[#FFFDF9] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#17151D] text-[#FDBA74]"><Icon className="h-6 w-6" /></div><p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-[#C2410C]">Step {index + 1}</p><h3 className="mt-2 text-xl font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-[#635B6C]">{body}</p></article>)}</div></div></section>;
}

function ComparisonSection() {
  const scattered = ['Chat', 'Tasks', 'Docs', 'Spreadsheets', 'Email threads'];
  const connected = ['Focused discussions', 'Project tasks', 'Knowledge base', 'Shared files', 'Reports'];
  return <section className="bg-[#F7F5F2] py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mx-auto max-w-3xl text-center"><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">Comparison</p><h2 className="mt-4 text-4xl font-black tracking-normal sm:text-5xl">Replace scattered tools with one connected workspace.</h2></div><div className="mt-12 grid gap-5 lg:grid-cols-2"><ComparisonCard title="Traditional workflow" muted items={scattered} /><ComparisonCard title="TriCord" items={connected} /></div></div></section>;
}

function ComparisonCard({ title, items, muted = false }: { title: string; items: string[]; muted?: boolean }) {
  return <article className={cn('rounded-3xl border p-6 shadow-sm', muted ? 'border-[#E5DED4] bg-white' : 'border-[#F97316] bg-[#17151D] text-white shadow-2xl shadow-[#C2410C]/16')}><h3 className="text-2xl font-black">{title}</h3><div className="mt-6 grid gap-3">{items.map((item, index) => <div key={item} className={cn('flex items-center gap-3 rounded-xl border p-4', muted ? 'border-[#E5DED4] bg-[#F7F5F2] text-[#635B6C]' : 'border-white/10 bg-white/8 text-white/78')}><span className={cn('grid h-8 w-8 place-items-center rounded-lg text-xs font-black', muted ? 'bg-[#E5DED4]' : 'bg-[#F97316] text-[#431407]')}>{muted ? index + 1 : <Check className="h-4 w-4" />}</span><span className="font-bold">{item}</span></div>)}</div></article>;
}

function UseCases() {
  const useCases = [['Individuals', 'Capture client requests, personal projects, repeatable processes, and daily work in a calmer place than chat.'], ['Teams', 'Coordinate projects, support work, sales follow-ups, onboarding, and internal operations without scattering context.'], ['Organizations', 'Give leaders visibility across rooms, tasks, procedures, and optional business modules as the team grows.']];
  return <MarketingSection eyebrow="Use cases" title="One hub, many ways to run the day." body="TriCord is flexible enough for solo operators and structured enough for teams that need visibility across work and people operations."><div className="grid gap-4 md:grid-cols-3">{useCases.map(([title, body]) => <div key={title} className="rounded-2xl border border-[#E5DED4] bg-white p-6 shadow-sm"><h3 className="text-xl font-black">{title}</h3><p className="mt-3 leading-7 text-[#635B6C]">{body}</p></div>)}</div></MarketingSection>;
}

function Testimonials() {
  const proofs = [['Less status chasing', 'Keep updates, files, decisions, and next steps attached to the original post.'], ['Clearer accountability', 'Assign owners and due dates from the same place where the work is discussed.'], ['Safer access boundaries', 'Owners can separate internal work, client Rooms, and workforce records by role.']];
  return <section className="border-y border-[#E5DED4] bg-white py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="max-w-3xl"><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">Built for operations</p><h2 className="mt-4 text-4xl font-black tracking-normal sm:text-5xl">Practical structure for teams that move fast.</h2><p className="mt-5 text-lg leading-8 text-[#635B6C]">TriCord avoids fake customer claims and focuses on the product outcomes small businesses can evaluate for themselves.</p></div><div className="mt-10 grid gap-4 lg:grid-cols-3">{proofs.map(([title, body]) => <article key={title} className="rounded-2xl border border-[#E5DED4] bg-[#FFFDF9] p-6 shadow-sm"><h3 className="text-xl font-black text-[#17151D]">{title}</h3><p className="mt-4 leading-7 text-[#3D3744]">{body}</p></article>)}</div></div></section>;
}

function Pricing({ appUrl, onLaunch }: { appUrl: string; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const plans = [
    { name: 'Free', price: '$0', note: 'For founders and very small teams', cta: 'Start free', featured: false, features: ['1 owned Hub', 'Up to 10 members per Hub', '5 guests per Hub', '10 Rooms', '90 days searchable history', '1 GB Hub storage', 'Tasks, knowledge base, and core collaboration'] },
    { name: 'Plus', price: '$8', note: 'Per billable user/month, billed yearly', cta: 'Choose Plus', featured: true, features: ['5 owned Hubs', 'Up to 100 billable members per Hub', '50 guests per Hub', 'Unlimited Rooms', 'Unlimited history', '100 GB Hub storage', 'Optional Business Modules and exports'] },
    { name: 'Pro', price: '$15', note: 'Per billable user/month, billed yearly', cta: 'Choose Pro', featured: false, features: ['Unlimited owned Hubs', 'Unlimited members with fair use', '1 TB Hub storage', 'Custom history retention', 'Advanced Business Module controls', 'Custom reports and activity history', 'Priority support'] },
  ];
  return <section id="pricing" className="bg-[#F7F5F2] py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mx-auto max-w-3xl text-center"><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">Plans</p><h2 className="mt-4 text-4xl font-black tracking-normal sm:text-5xl">Start free. Upgrade when your team needs more capacity.</h2><p className="mt-5 text-lg leading-8 text-[#635B6C]">Start with the essentials. Upgrade when you need more members, history, storage, reporting, and optional business modules.</p></div><div className="mt-12 grid gap-5 lg:grid-cols-3">{plans.map((plan) => <div key={plan.name} className={cn('rounded-3xl border p-6 shadow-sm', plan.featured ? 'border-[#F97316] bg-[#17151D] text-white shadow-xl shadow-[#C2410C]/14' : 'border-[#E5DED4] bg-white')}><p className={cn('text-sm font-black uppercase tracking-[0.16em]', plan.featured ? 'text-[#FDBA74]' : 'text-[#C2410C]')}>{plan.name}</p><div className="mt-4 flex items-end gap-2"><strong className="text-5xl font-black">{plan.price}</strong>{plan.name !== 'Free' && <span className={plan.featured ? 'text-white/65' : 'text-[#7A7183]'}>/user</span>}</div><p className={cn('mt-3 text-sm leading-6', plan.featured ? 'text-white/70' : 'text-[#635B6C]')}>{plan.note}</p><a href={appUrl} onClick={onLaunch} className={cn('mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-bold transition hover:-translate-y-0.5', plan.featured ? 'bg-[#F97316] text-[#431407]' : 'bg-[#17151D] text-white')}>{plan.cta}</a><ul className="mt-6 space-y-3 text-sm">{plan.features.map((item) => <li key={item} className="flex gap-3"><CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', plan.featured ? 'text-[#FDBA74]' : 'text-[#0D9488]')} /> <span className={plan.featured ? 'text-white/78' : 'text-[#3D3744]'}>{item}</span></li>)}</ul></div>)}</div><p className="mx-auto mt-6 max-w-3xl text-center text-sm leading-6 text-[#635B6C]">Plan limits, billable seats, taxes, and renewal terms are confirmed at checkout. Guests are not billed unless a plan page or checkout screen says otherwise.</p></div></section>;
}

function Security() {
  return <section id="security" className="border-y border-[#E5DED4] bg-white py-20 sm:py-24"><div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8"><div><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">Trust</p><h2 className="mt-4 text-4xl font-black tracking-normal sm:text-5xl">Security and privacy in plain business language.</h2><p className="mt-5 text-lg leading-8 text-[#635B6C]">TriCord is designed so people only see what they need. Sensitive team and workforce information stays protected with clear roles, guest boundaries, and activity visibility for authorized leaders.</p></div><div className="grid gap-4 sm:grid-cols-2">{[['Secure sign-in', 'Every user signs in with their own account.'], ['Private profile details', 'Sensitive contact and employee details stay separate from public profile information.'], ['Guest boundaries', 'External collaborators only see Rooms and content shared with them.'], ['Activity history', 'Important business changes can be reviewed by authorized leaders.']].map(([title, body]) => <div key={title} className="rounded-2xl border border-[#E5DED4] bg-[#FFFDF9] p-5"><KeyRound className="h-5 w-5 text-[#C2410C]" /><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-[#635B6C]">{body}</p></div>)}</div></div></section>;
}

function FAQ() {
  const faqs = [['What is TriCord?', 'TriCord is a work hub for SMEs and startups that combines focused discussions, Rooms, tasks, SOPs, files, reports, and admin controls in one product.'], ['How is TriCord different from chat apps?', 'TriCord keeps work organized around posts instead of endless channels. Each post keeps the conversation, files, decisions, tasks, and context together.'], ['Can I use TriCord with clients or guests?', 'Yes. Guests can be invited into specific Rooms so external collaborators only see the work meant for them.'], ['Can TriCord support business recordkeeping?', 'Yes. Optional Business Modules can help organize attendance tracking, employee records, and payroll preparation. TriCord is not a payroll processor, tax advisor, legal advisor, HR consulting service, PEO, or employer of record.'], ['Can I store medical or patient information?', 'No. TriCord is not designed for protected health information and does not support HIPAA-regulated workflows in this release.'], ['Where do users sign in?', 'Use the Start Free button to open the app. Owners, Admins, Members, and Guests all sign in from the same product entry point.']];
  return <section id="faq" className="bg-[#FFFDF9] py-20 sm:py-24"><div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8"><div className="text-center"><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">FAQ</p><h2 className="mt-4 text-4xl font-black tracking-normal sm:text-5xl">Questions before you start?</h2></div><div className="mt-10 divide-y divide-[#E5DED4] rounded-2xl border border-[#E5DED4] bg-white shadow-sm">{faqs.map(([question, answer]) => <details key={question} className="group p-6"><summary className="cursor-pointer list-none text-lg font-black marker:hidden">{question}</summary><p className="mt-3 leading-7 text-[#635B6C]">{answer}</p></details>)}</div></div></section>;
}

function FinalCTA({ appUrl, onLaunch }: { appUrl: string; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return <section className="bg-[#F97316] py-16 text-[#431407]"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8"><div><h2 className="text-3xl font-black tracking-normal sm:text-4xl">Give your team one place to work from.</h2><p className="mt-3 max-w-2xl text-lg leading-8 text-[#5B1B06]">Start a Hub, invite your team, and see how much smoother work feels when the conversation and execution stay connected.</p></div><a href={appUrl} onClick={onLaunch} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#17151D] px-5 text-sm font-bold text-white shadow-lg shadow-[#431407]/18 transition hover:-translate-y-0.5">Start Free <ArrowRight className="h-4 w-4" /></a></div></section>;
}

function MarketingFooter({ appUrl, marketingBasePath, onLaunch }: { appUrl: string; marketingBasePath: string; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const legalHref = (page: keyof typeof legalContent) => joinMarketingPath(marketingBasePath, page);
  return <footer className="bg-[#17151D] py-12 text-white"><div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] lg:px-8"><div><div className="flex items-center gap-3"><BrandMark /><span className="text-xl font-black">TriCord</span></div><p className="mt-4 max-w-sm text-sm leading-6 text-white/62">A modern work hub for conversations, projects, SOPs, files, and everyday business operations.</p><p className="mt-4 text-sm text-white/62">Contact: hello@tricord.cc</p></div><FooterColumn title="Product" links={[["Features", joinMarketingPath(marketingBasePath, '#features')], ['Tour', joinMarketingPath(marketingBasePath, '#tour')], ['Pricing', joinMarketingPath(marketingBasePath, '#pricing')], ['Get started', appUrl]]} onLaunch={onLaunch} appUrl={appUrl} /><FooterColumn title="Resources" links={[["Workflow", joinMarketingPath(marketingBasePath, '#workflow')], ['Security', joinMarketingPath(marketingBasePath, '#security')], ['FAQ', joinMarketingPath(marketingBasePath, '#faq')], ['Help center', joinMarketingPath(marketingBasePath, '#faq')]]} onLaunch={onLaunch} appUrl={appUrl} /><FooterColumn title="Legal" links={[["Privacy", legalHref('privacy')], ['Terms', legalHref('terms')], ['Acceptable Use', legalHref('acceptable-use')], ['Refund Policy', legalHref('refund')], ['Subprocessors', legalHref('subprocessors')], ['Security', legalHref('security')], ['Accessibility', legalHref('accessibility')]]} onLaunch={onLaunch} appUrl={appUrl} /></div><div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 px-4 pt-6 text-xs text-white/50 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8"><p>© {new Date().getFullYear()} TriCord. All rights reserved.</p><p>TriCord helps organize business operations. Optional Business Modules are recordkeeping tools and do not replace regulated systems or professional advice.</p></div></footer>;
}

function MarketingButton({ href, onClick, children }: { href: string; onClick: (event: MouseEvent<HTMLAnchorElement>) => void; children: ReactNode }) {
  return <a href={href} onClick={onClick} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#F97316] px-5 text-sm font-black text-[#431407] shadow-lg shadow-[#C2410C]/24 transition hover:-translate-y-0.5 hover:bg-[#FDBA74]">{children}</a>;
}

function MarketingSection({ id, eyebrow, title, body, children }: { id?: string; eyebrow: string; title: string; body: string; children: ReactNode }) {
  return <section id={id} className="bg-[#F7F5F2] py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mb-10 max-w-3xl"><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">{eyebrow}</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-normal sm:text-5xl">{title}</h2><p className="mt-5 text-lg leading-8 text-[#635B6C]">{body}</p></div>{children}</div></section>;
}

function AvatarDot({ initial }: { initial: string }) {
  return <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFEDD5] text-sm font-black text-[#C2410C]">{initial}</span>;
}

const legalContent = {
  terms: {
    eyebrow: 'Terms',
    title: 'Terms and Conditions',
    updated: 'Last updated July 13, 2026',
    intro: 'These terms are written for business customers in plain language. They reduce ambiguity, but they are not legal advice and should be reviewed by counsel before you rely on them as your final customer contract.',
    sections: [
      ['Using TriCord', 'TriCord provides a work hub for business communication, task coordination, knowledge sharing, reporting, file sharing, email routing, and optional Business Modules such as attendance tracking, employee records, and payroll preparation. You are responsible for the accuracy, legality, and appropriateness of the information your organization adds to TriCord.'],
      ['Accounts and access', 'Hub Owners are responsible for invited users, role permissions, billing choices, Room access, and internal policies. Each person must use their own account and must not share sign-in links, passwords, or private business information with unauthorized people.'],
      ['Subscription, seats, and billing', 'Paid plans are billed through Stripe or another payment provider shown at checkout. Owners are responsible for billable seats, upgrades, downgrades, renewals, applicable taxes, and any plan limits shown in the app or at checkout. Guests are not billed unless a plan or checkout screen states otherwise.'],
      ['Customer content', 'You keep ownership of your Hub content, messages, files, email content, records, and business data. You grant TriCord permission to host, store, process, display, transmit, and back up that content only as needed to provide, secure, support, and improve the service.'],
      ['Prohibited regulated data', 'Do not upload protected health information, payment card numbers, bank login credentials, government secrets, classified information, biometric identifiers, or other regulated data unless TriCord has expressly agreed in writing to support that data type. TriCord is not HIPAA-compliant in this release and does not sign Business Associate Agreements.'],
      ['Optional Business Modules', 'Business Modules are organizational and recordkeeping tools only. TriCord is not a law firm, accounting firm, payroll processor, tax advisor, HR consultant, Professional Employer Organization, employer of record, or substitute for licensed professional advice. You are responsible for wage, hour, tax, leave, privacy, employee-notice, candidate-notice, customer-contact, and record-retention compliance.'],
      ['Email and communications', 'If you use TriCord to send or forward email, you represent that you have permission and a lawful basis to contact recipients and process the email content. You may not use TriCord for spam, deceptive messages, unlawful marketing, or unauthorized surveillance.'],
      ['Files and uploads', 'You are responsible for files uploaded or linked in TriCord. We may block file types, enforce size limits, remove harmful content, or suspend access if files create security, legal, or operational risk.'],
      ['Third-party services', 'TriCord may rely on service providers such as hosting, database, payment, storage, and email providers. Third-party services may have their own terms, availability, security practices, and data processing rules.'],
      ['No warranties', 'TriCord is provided on an as-is and as-available basis to the maximum extent allowed by law. We do not promise uninterrupted service, error-free operation, legal compliance outcomes, payroll accuracy, tax accuracy, compliance outcomes, or that the service will meet every requirement of your organization.'],
      ['Limitation of liability', 'To the maximum extent allowed by law, TriCord will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, lost profits, lost revenue, lost data, business interruption, or compliance failures caused by your use of the service.'],
      ['Indemnity', 'You agree to defend and hold TriCord harmless from claims arising from your content, your misuse of the service, your violation of law, your violation of these terms, or your infringement of another person’s rights.'],
      ['Suspension and termination', 'We may suspend or terminate access if necessary to protect users, comply with law, prevent abuse, address unpaid fees, or reduce security risk. Owners should export important business records before closing a Hub.'],
      ['Governing law and disputes', 'These terms should be finalized with counsel once your legal entity is formed. Until then, any dispute language should be treated as a placeholder and reviewed before paid public launch.'],
      ['Contact', 'Questions about these terms can be sent to hello@tricord.cc.'],
    ],
  },
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    updated: 'Last updated July 13, 2026',
    intro: 'This policy explains how TriCord handles account, business, workforce, billing, file, and communication data. Hub Owners are responsible for giving their users and employees any notices required by law.',
    sections: [
      ['Information we collect', 'TriCord may collect account details, profile information, email addresses, nicknames, photos, Hub and Room content, posts, comments, attachments, task data, knowledge articles, reports, billing status, support messages, and usage events needed to operate the service. If optional Business Modules are enabled, TriCord may also process attendance records, employee records, leave records, performance records, compensation fields, and payroll-preparation fields.'],
      ['Sensitive workforce data', 'Depending on your Hub settings and enabled Business Modules, TriCord may store employee addresses, contact numbers, birthdays, emergency contacts, documents, compensation notes, payment-method details, IP addresses, device information, GPS location, map links, and photo-verification images. Owners must provide employee notices and obtain any required consent before enabling these features.'],
      ['How we use information', 'We use information to provide the product, secure accounts, show the right content to the right users, process subscriptions, send operational email, support customers, troubleshoot issues, prevent abuse, maintain records requested by Hub Owners, and improve reliability.'],
      ['Role-based access', 'TriCord is designed around Hubs, Rooms, roles, and permissions. Owners and authorized Admins may access business records and enabled Business Module records needed to operate a Hub. Members and Guests should only see the content and records permitted for their role.'],
      ['Payments', 'Payment card details are handled by Stripe or the payment provider shown at checkout. TriCord does not store full card numbers. We may store plan, subscription, customer, invoice, billing-seat, and payment-status identifiers needed to manage access.'],
      ['Files, email, and integrations', 'Uploaded files, shared links, forwarded emails, outbound email commands, and integration metadata may be processed so TriCord can display, route, secure, and retain them for the Hub. Do not route protected health information or other prohibited regulated data through TriCord.'],
      ['Subprocessors', 'TriCord may use trusted service providers for hosting, database, storage, authentication, payments, email delivery, domain hosting, logging, and customer support. A current subprocessor list is available on the Subprocessors page.'],
      ['Cookies and local storage', 'TriCord may use cookies, browser storage, and similar technologies for sign-in, security, preferences, theme settings, session state, and product functionality. If analytics or advertising tools are added later, this policy and any consent controls should be updated first.'],
      ['Security', 'We use access controls, authentication, database permissions, storage rules, size limits, operational safeguards, and security monitoring practices intended to protect customer data. No online service can guarantee absolute security, so users should also protect their accounts, devices, and email inboxes.'],
      ['Retention and deletion', 'Content and records may remain available according to plan limits, Hub settings, backup schedules, legal needs, billing requirements, and operational requirements. Owners are responsible for deciding what their organization must retain, export, archive, or remove.'],
      ['Privacy requests', 'Users may contact hello@tricord.cc for privacy questions or requests. Some requests may need to be handled by the Hub Owner because the Owner controls business and workforce records inside the Hub.'],
      ['Children', 'TriCord is intended for business use and is not directed to children. Do not create accounts for children or submit children’s personal information.'],
      ['Changes', 'We may update this policy as TriCord evolves. Material changes should be communicated in a reasonable way before they take effect.'],
    ],
  },
  'acceptable-use': {
    eyebrow: 'Acceptable Use',
    title: 'Acceptable Use Policy',
    updated: 'Last updated July 13, 2026',
    intro: 'This policy keeps TriCord safe for business collaboration and reduces risk for all customers.',
    sections: [
      ['No unlawful use', 'Do not use TriCord to violate laws, contracts, privacy rights, employment rights, intellectual property rights, export rules, anti-spam rules, or security requirements.'],
      ['No harmful content or files', 'Do not upload malware, exploit code, credential lists, harmful scripts, illegal content, or files intended to damage, disrupt, or gain unauthorized access to systems or data.'],
      ['No regulated data without written approval', 'Do not store protected health information, full payment card data, bank login credentials, biometric identifiers, classified data, or other regulated data unless TriCord has expressly agreed in writing to support that data.'],
      ['No spam or deceptive communications', 'Do not use email features for spam, phishing, impersonation, deceptive headers, unlawful marketing, harassment, or messages to recipients who should not receive them.'],
      ['Respect confidentiality', 'Do not invite users, forward emails, upload files, or disclose information unless you have permission and a legitimate business reason.'],
      ['Enforcement', 'We may remove content, restrict features, suspend users, disable Hubs, or contact affected parties when needed to protect the service, comply with law, or reduce risk.'],
    ],
  },
  refund: {
    eyebrow: 'Refunds',
    title: 'Refund and Cancellation Policy',
    updated: 'Last updated July 13, 2026',
    intro: 'This policy explains the default billing approach. Final terms should be reviewed once the TriCord legal entity is formed.',
    sections: [
      ['Free plan', 'The Free plan can be used without subscription charges, subject to plan limits and acceptable-use rules.'],
      ['Paid plans', 'Paid plans are billed through Stripe or the payment provider shown at checkout. The checkout page controls the billing interval, price, billable seats, taxes, and renewal terms.'],
      ['Seat changes', 'When billable users are added or removed, charges, credits, or prorations may appear on the current or next invoice depending on payment-provider settings. Promo codes and discounts must be entered or applied through the payment provider before payment is completed.'],
      ['Cancellations', 'Owners can cancel or change paid plans through the billing portal when available. Cancellation usually stops future renewal charges but does not automatically refund prior payments.'],
      ['Refunds', 'Unless required by law or expressly stated at checkout, subscription payments are generally non-refundable after the billing period begins. If a billing error occurs, contact hello@tricord.cc promptly.'],
      ['Taxes', 'Prices may not include taxes, duties, or government fees. The Hub Owner is responsible for applicable taxes unless they are collected at checkout.'],
    ],
  },
  subprocessors: {
    eyebrow: 'Subprocessors',
    title: 'Subprocessor List',
    updated: 'Last updated July 13, 2026',
    intro: 'TriCord uses service providers to operate the product. This list should be reviewed and updated whenever providers change.',
    sections: [
      ['Supabase', 'Hosted database, authentication, file storage, realtime updates, and serverless functions.'],
      ['Stripe', 'Checkout, customer portal, subscription management, invoicing, billing events, and payment processing.'],
      ['Resend', 'Transactional email delivery and inbound email routing where enabled.'],
      ['GoDaddy or website host', 'Domain, DNS, hosting, SSL, and static website delivery where configured by the business owner.'],
      ['Google and Microsoft integrations', 'Optional user-authorized integrations may process limited metadata or email/send permissions when enabled. If these integrations are disabled, users can still paste ordinary links.'],
      ['Future providers', 'Analytics, monitoring, customer support, backup, or logging providers should not be added until this page and the Privacy Policy are updated.'],
    ],
  },
  security: {
    eyebrow: 'Security',
    title: 'Security Overview',
    updated: 'Last updated July 13, 2026',
    intro: 'Security is a shared responsibility between TriCord, Hub Owners, Admins, and users. This page describes the current practical safeguards without making absolute guarantees.',
    sections: [
      ['Account security', 'Each user should have their own account and protect access to their email inbox and sign-in links. Shared accounts are not allowed.'],
      ['Access control', 'TriCord uses Hub membership, Room access, roles, and granular Admin permissions to limit what users can see and do. Owners should review permissions regularly.'],
      ['Data protection', 'TriCord uses managed infrastructure, database permissions, storage rules, private buckets where appropriate, file-size controls, and operational safeguards to reduce unauthorized access risk.'],
      ['Uploads and links', 'File uploads are limited by size and may be restricted by type. Users should not upload malware, highly regulated data, or content they are not permitted to share.'],
      ['Incident reporting', 'Report suspected security issues, account compromise, or data exposure to hello@tricord.cc as soon as possible.'],
      ['No absolute guarantee', 'No internet service can guarantee perfect security. Customers should use strong email security, device protection, least-privilege roles, regular access reviews, and internal policies.'],
    ],
  },
  accessibility: {
    eyebrow: 'Accessibility',
    title: 'Accessibility Statement',
    updated: 'Last updated July 13, 2026',
    intro: 'TriCord aims to provide a usable experience for all customers and team members.',
    sections: [
      ['Our goal', 'We aim to build clear navigation, readable contrast, keyboard-friendly controls, labels, responsive layouts, and predictable workflows.'],
      ['Ongoing work', 'Accessibility is an ongoing process. New features should be checked for keyboard access, focus states, semantic labels, contrast, and text readability before release.'],
      ['Feedback', 'If you encounter an accessibility issue, contact hello@tricord.cc with the page, browser, assistive technology if applicable, and a short description of the problem.'],
    ],
  },
} as const;

function LegalPage({ page, appUrl, homeUrl, onLaunch }: { page: keyof typeof legalContent; appUrl: string; homeUrl: string; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const content = legalContent[page];
  return <section className="bg-[#F7F5F2] py-16 sm:py-20"><div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8"><a href={homeUrl} className="text-sm font-bold text-[#C2410C] hover:text-[#17151D]">Back to home</a><p className="mt-10 text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">{content.eyebrow}</p><h1 className="mt-4 text-4xl font-black tracking-normal sm:text-5xl">{content.title}</h1><p className="mt-3 text-sm font-semibold text-[#7A7183]">{content.updated}</p><p className="mt-6 text-lg leading-8 text-[#635B6C]">{content.intro}</p><div className="mt-10 space-y-5">{content.sections.map(([title, body]) => <article key={title} className="rounded-2xl border border-[#E5DED4] bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{title}</h2><p className="mt-3 leading-7 text-[#635B6C]">{body}</p></article>)}</div><div className="mt-10 rounded-2xl bg-[#17151D] p-6 text-white"><h2 className="text-2xl font-black">Ready to try TriCord?</h2><p className="mt-2 text-white/70">Open the app, create a Hub, and keep your team work organized in one place.</p><a href={appUrl} onClick={onLaunch} className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-[#F97316] px-4 text-sm font-black text-[#431407]">Start Free</a></div></div></section>;
}

function getMarketingPage(marketingBasePath: string): 'home' | keyof typeof legalContent {
  const base = marketingBasePath.replace(/\/+$/, '').replace(/^\/+/, '');
  let path = window.location.pathname.replace(/\/+$/, '').replace(/^\/+/, '');
  if (base && (path === base || path.startsWith(`${base}/`))) {
    path = path.slice(base.length).replace(/^\/+/, '');
  }
  if (path in legalContent) return path as keyof typeof legalContent;
  return 'home';
}

function getMarketingBasePath(appUrl: string) {
  const appPath = appUrl.split(/[?#]/)[0]?.replace(/\/+$/, '') || '/app';
  const base = appPath.endsWith('/app') ? appPath.slice(0, -4) : '';
  return base || '/';
}

function joinMarketingPath(basePath: string, pageOrHash: keyof typeof legalContent | `#${string}`) {
  const base = basePath === '/' ? '' : basePath.replace(/\/+$/, '');
  if (pageOrHash.startsWith('#')) return `${base || '/'}${pageOrHash}`;
  return `${base}/${pageOrHash}`;
}

function FooterColumn({ title, links, onLaunch, appUrl }: { title: string; links: [string, string][]; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void; appUrl: string }) {
  return <div><h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/45">{title}</h3><ul className="mt-4 space-y-3 text-sm text-white/68">{links.map(([label, href]) => <li key={label}><a href={href} onClick={href === appUrl ? onLaunch : undefined} className="hover:text-white">{label}</a></li>)}</ul></div>;
}

function BrandMark({ small = false }: { small?: boolean }) {
  return <span className={cn('flex items-center justify-center rounded-xl bg-[#F97316] shadow-lg shadow-[#C2410C]/20', small ? 'h-9 w-9' : 'h-10 w-10')}><img src={triCordLogo} alt="" aria-hidden="true" draggable={false} className={small ? 'h-6 w-6 object-contain' : 'h-7 w-7 object-contain'} /></span>;
}

function ensureMetaDescription() {
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'description');
    document.head.appendChild(meta);
  }
  return meta;
}
