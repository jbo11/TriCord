import { useEffect, type MouseEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  ClipboardList,
  FileText,
  KeyRound,
  LayoutGrid,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import triCordLogo from '../assets/tricord-logo.png';

export function MarketingHome({ appUrl }: { appUrl: string }) {
  useEffect(() => {
    const previousTitle = document.title;
    const meta = ensureMetaDescription();
    const previousDescription = meta.getAttribute('content') ?? '';
    document.title = 'TriCord | Conversations, tasks, knowledge, and operations in one hub';
    meta.setAttribute('content', 'TriCord is a modern collaboration hub for teams that need focused discussions, task tracking, knowledge, timekeeping, HR, payroll previews, and reports in one place.');
    return () => {
      document.title = previousTitle;
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

  const primaryCta = <MarketingButton href={appUrl} onClick={launchApp}>Get started <ArrowRight className="h-4 w-4" /></MarketingButton>;

  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#17151D] antialiased">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold">Skip to content</a>
      <MarketingHeader appUrl={appUrl} onLaunch={launchApp} />
      <main id="main">
        <Hero appUrl={appUrl} onLaunch={launchApp} primaryCta={primaryCta} />
        <LogoStrip />
        <MarketingSection eyebrow="Why TriCord" title="Work gets messy when the conversation, task, and answer live in different places." body="TriCord gives teams one operational home: rooms for organization, posts for context, tasks for execution, knowledge for repeatability, and workforce tools for the people doing the work.">
          <div className="grid gap-4 md:grid-cols-3">
            {benefits.map(renderMarketingCard)}
          </div>
        </MarketingSection>
        <FeatureSection primaryCta={primaryCta} />
        <HowItWorks />
        <TourSection />
        <UseCases />
        <Testimonials />
        <Pricing appUrl={appUrl} onLaunch={launchApp} />
        <Security />
        <FAQ />
        <FinalCTA appUrl={appUrl} onLaunch={launchApp} />
      </main>
      <MarketingFooter appUrl={appUrl} onLaunch={launchApp} />
    </div>
  );
}

const benefits = [
  { icon: MessageSquare, title: 'For operators', body: 'Keep client updates, decisions, files, and follow-up work attached to the post that created them.' },
  { icon: ClipboardList, title: 'For project leads', body: 'Turn conversations into board, list, and calendar work without losing the context behind each task.' },
  { icon: BriefcaseBusiness, title: 'For business owners', body: 'Manage people, permissions, HR records, timekeeping, payroll previews, and reports from one focused hub.' },
];

const features = [
  { icon: MessageSquare, title: 'Post-based collaboration', body: 'Replace noisy channels with posts that hold the discussion, files, replies, assignments, and outcomes together.' },
  { icon: LayoutGrid, title: 'Project-ready Tasks', body: 'Use board, list, and calendar views to plan work, assign owners, track deadlines, and archive completed work.' },
  { icon: FileText, title: 'Knowledge base', body: 'Publish how-to guides, SOPs, FAQs, troubleshooting notes, and best practices where the team already works.' },
  { icon: Clock3, title: 'Workforce tools', body: 'Clock in, review attendance, manage employee profiles, leave requests, documents, and payroll preview workflows.' },
  { icon: ShieldCheck, title: 'Role-aware admin', body: 'Give Owners, Admins, Members, and Guests only the access they need, backed by database-level permissions.' },
  { icon: Sparkles, title: 'Built for the next layer', body: 'TriCord is structured for future automations, integrations, and AI-assisted search without cluttering the core experience.' },
];

function MarketingHeader({ appUrl, onLaunch }: { appUrl: string; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E5DED4]/80 bg-[#F7F5F2]/92 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-3" aria-label="TriCord home"><BrandMark /><span className="text-xl font-extrabold">TriCord</span></a>
        <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-semibold text-[#5F5668] lg:flex">
          <a className="hover:text-[#17151D]" href="#features">Features</a>
          <a className="hover:text-[#17151D]" href="#how-it-works">How it works</a>
          <a className="hover:text-[#17151D]" href="#pricing">Pricing</a>
          <a className="hover:text-[#17151D]" href="#security">Security</a>
          <a className="hover:text-[#17151D]" href="#faq">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <a href={appUrl} onClick={onLaunch} className="hidden rounded-lg px-4 py-2 text-sm font-bold text-[#5F5668] hover:text-[#17151D] sm:inline-flex">Sign in</a>
          <a href={appUrl} onClick={onLaunch} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#17151D] px-4 text-sm font-bold text-white shadow-lg shadow-[#17151D]/20 transition hover:bg-[#2A2432]">Get Started</a>
        </div>
      </div>
    </header>
  );
}

function Hero({ primaryCta }: { appUrl: string; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void; primaryCta: ReactNode }) {
  return (
    <section id="top" className="relative isolate overflow-hidden border-b border-[#E5DED4] bg-[#17151D] text-white">
      <ProductBackdrop />
      <div className="relative z-10 mx-auto grid min-h-[760px] max-w-7xl content-end px-4 pb-12 pt-16 sm:px-6 lg:px-8 lg:pb-18">
        <div className="max-w-4xl py-16">
          <p className="mb-5 inline-flex rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-bold text-[#FFD7B0] backdrop-blur">A calmer work hub for teams that need context, not chaos</p>
          <h1 className="max-w-5xl text-5xl font-black leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">Run conversations, projects, knowledge, and operations in one connected hub.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/78 sm:text-xl">TriCord keeps every post, reply, file, task, decision, and people workflow together so teams can move faster without losing the thread.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">{primaryCta}<a href="#features" className="inline-flex h-12 items-center justify-center rounded-lg border border-white/18 bg-white/10 px-5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/16">Explore features</a></div>
          <div className="mt-10 grid max-w-3xl gap-4 text-sm text-white/72 sm:grid-cols-3"><p><strong className="block text-2xl text-white">4 roles</strong>Owner, Admin, Member, Guest</p><p><strong className="block text-2xl text-white">1 flow</strong>Posts to tasks to knowledge</p><p><strong className="block text-2xl text-white">0 clutter</strong>Focused rooms and discussions</p></div>
        </div>
      </div>
    </section>
  );
}

function LogoStrip() {
  return <section className="border-b border-[#E5DED4] bg-white py-8"><div className="mx-auto grid max-w-7xl gap-4 px-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-[#7A7183] sm:px-6 md:grid-cols-4 lg:px-8">{['Built for remote teams', 'Role-aware by design', 'Post-based context', 'Ready for public beta'].map((item) => <p key={item}>{item}</p>)}</div></section>;
}

function FeatureSection({ primaryCta }: { primaryCta: ReactNode }) {
  return <section id="features" className="border-y border-[#E5DED4] bg-[#FFFDF9] py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"><div><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">Feature highlights</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-normal sm:text-5xl">Everything important stays connected to the work.</h2><p className="mt-5 text-lg leading-8 text-[#635B6C]">TriCord blends the speed of chat with the memory of a knowledge base and the accountability of project management.</p><div className="mt-8">{primaryCta}</div></div><ProductMockup /></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(renderMarketingCard)}</div></div></section>;
}

function HowItWorks() {
  const steps = [['Create a Hub', 'Start a workspace for your company, department, client team, or project.'], ['Open Rooms', 'Organize active work by room while keeping the feed easy to scan.'], ['Post the work', 'Create a focused post for every request, update, decision, or process.'], ['Coordinate execution', 'Reply, attach files, assign tasks, record knowledge, and report progress in one flow.']];
  return <MarketingSection id="how-it-works" eyebrow="How it works" title="From first update to finished work in four clear steps." body="TriCord is simple enough for a small team and structured enough for growing operations."><div className="grid gap-4 md:grid-cols-4">{steps.map(([title, body], index) => <div key={title} className="rounded-xl border border-[#E5DED4] bg-white p-5 shadow-sm"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFEDD5] text-sm font-black text-[#C2410C]">{index + 1}</span><h3 className="mt-5 text-lg font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-[#635B6C]">{body}</p></div>)}</div></MarketingSection>;
}

function TourSection() {
  return <section className="bg-[#17151D] py-20 text-white sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"><div><p className="text-sm font-black uppercase tracking-[0.22em] text-[#FDBA74]">Product tour</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-normal sm:text-5xl">A workspace that feels familiar on day one.</h2><p className="mt-5 text-lg leading-8 text-white/72">The interface is built for scanning, repeated use, and clear action. Create a post, discuss it, assign work, turn learnings into knowledge, and keep the business side close by.</p></div><VideoMockup /></div></div></section>;
}

function UseCases() {
  const useCases = [['Individuals', 'Capture client requests, personal projects, reusable procedures, and daily work in a calmer place than chat.'], ['Teams', 'Coordinate projects, support work, sales follow-ups, onboarding, and internal operations without scattering context.'], ['Organizations', 'Give leaders visibility across rooms, people, tasks, attendance, policies, and business health as the team grows.']];
  return <MarketingSection eyebrow="Use cases" title="One hub, many ways to work." body="TriCord is flexible enough for solo operators and structured enough for teams that need operational visibility."><div className="grid gap-4 md:grid-cols-3">{useCases.map(([title, body]) => <div key={title} className="rounded-xl border border-[#E5DED4] bg-white p-6 shadow-sm"><h3 className="text-xl font-black">{title}</h3><p className="mt-3 leading-7 text-[#635B6C]">{body}</p></div>)}</div></MarketingSection>;
}

function Testimonials() {
  const reviews = [['TriCord makes our remote work feel less scattered. The post-based model keeps every decision and task in the same place.', 'Operations Lead', 'Virtual services team'], ['We finally have one place for team updates, SOPs, and day-to-day task tracking. It feels lightweight but still structured.', 'Founder', 'Growing agency'], ['The permissions model matters. Guests only see what they should, while admins can manage the parts they actually own.', 'Admin Manager', 'Client operations group']];
  return <section className="border-y border-[#E5DED4] bg-white py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="max-w-3xl"><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">Early feedback</p><h2 className="mt-4 text-4xl font-black tracking-normal sm:text-5xl">Designed with real operations in mind.</h2></div><div className="mt-10 grid gap-4 lg:grid-cols-3">{reviews.map(([quote, name, role]) => <figure key={name} className="rounded-xl border border-[#E5DED4] bg-[#FFFDF9] p-6"><blockquote className="leading-7 text-[#3D3744]">“{quote}”</blockquote><figcaption className="mt-6 text-sm"><strong className="block text-[#17151D]">{name}</strong><span className="text-[#7A7183]">{role}</span></figcaption></figure>)}</div></div></section>;
}

function Pricing({ appUrl, onLaunch }: { appUrl: string; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const plans = [
    { name: 'Free', price: '$0', note: 'For individuals and very small teams', cta: 'Start free', featured: false, features: ['1 owned Hub', '10 paid members per Hub', '5 guests per Hub', '10 Rooms', '90 days searchable message history', '1 GB Hub storage', 'Tasks, knowledge base, and basic timekeeping'] },
    { name: 'Plus', price: '$8', note: 'Per user/month, billed yearly', cta: 'Choose Plus', featured: true, features: ['5 owned Hubs', '100 paid members per Hub', '50 guests per Hub', 'Unlimited Rooms', 'Unlimited message history', '100 GB Hub storage', 'Full team timekeeping, HR records, payroll runs, exports'] },
    { name: 'Pro', price: '$15', note: 'Per user/month, billed yearly', cta: 'Choose Pro', featured: false, features: ['Unlimited owned Hubs', 'Unlimited members with fair use', '1 TB Hub storage', 'Custom retention', 'Advanced HR and payroll controls', 'Custom reports and audit history', 'Priority support and advanced security roadmap'] },
  ];
  return <section id="pricing" className="bg-[#F7F5F2] py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mx-auto max-w-3xl text-center"><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">Plans</p><h2 className="mt-4 text-4xl font-black tracking-normal sm:text-5xl">Start free. Upgrade when your team needs more room.</h2><p className="mt-5 text-lg leading-8 text-[#635B6C]">Simple plan boundaries make it clear when to grow without forcing teams to pay before TriCord proves itself.</p></div><div className="mt-12 grid gap-5 lg:grid-cols-3">{plans.map((plan) => <div key={plan.name} className={cn('rounded-xl border p-6 shadow-sm', plan.featured ? 'border-[#F97316] bg-[#17151D] text-white shadow-xl shadow-[#C2410C]/14' : 'border-[#E5DED4] bg-white')}><p className={cn('text-sm font-black uppercase tracking-[0.16em]', plan.featured ? 'text-[#FDBA74]' : 'text-[#C2410C]')}>{plan.name}</p><div className="mt-4 flex items-end gap-2"><strong className="text-5xl font-black">{plan.price}</strong>{plan.name !== 'Free' && <span className={plan.featured ? 'text-white/65' : 'text-[#7A7183]'}>/user</span>}</div><p className={cn('mt-3 text-sm leading-6', plan.featured ? 'text-white/70' : 'text-[#635B6C]')}>{plan.note}</p><a href={appUrl} onClick={onLaunch} className={cn('mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-bold', plan.featured ? 'bg-[#F97316] text-[#431407]' : 'bg-[#17151D] text-white')}>{plan.cta}</a><ul className="mt-6 space-y-3 text-sm">{plan.features.map((item) => <li key={item} className="flex gap-3"><CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', plan.featured ? 'text-[#FDBA74]' : 'text-[#0D9488]')} /> <span className={plan.featured ? 'text-white/78' : 'text-[#3D3744]'}>{item}</span></li>)}</ul></div>)}</div></div></section>;
}

function Security() {
  return <section id="security" className="border-y border-[#E5DED4] bg-white py-20 sm:py-24"><div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8"><div><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">Trust</p><h2 className="mt-4 text-4xl font-black tracking-normal sm:text-5xl">Security and privacy are part of the product, not an afterthought.</h2><p className="mt-5 text-lg leading-8 text-[#635B6C]">TriCord uses Supabase Auth, PostgreSQL Row Level Security, role-aware permissions, scoped guest access, private profile handling, and audit logging for sensitive business actions.</p></div><div className="grid gap-4 sm:grid-cols-2">{[['Row Level Security', 'Database policies enforce access beyond the interface.'], ['Private profile fields', 'Contact details and personal notes are separated from public profile data.'], ['Guest isolation', 'External users only see rooms explicitly shared with them.'], ['Audit trail', 'Important business changes can be reviewed by authorized roles.']].map(([title, body]) => <div key={title} className="rounded-xl border border-[#E5DED4] bg-[#FFFDF9] p-5"><KeyRound className="h-5 w-5 text-[#C2410C]" /><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-[#635B6C]">{body}</p></div>)}</div></div></section>;
}

function FAQ() {
  const faqs = [['What is TriCord?', 'TriCord is a collaboration hub that combines focused discussions, rooms, tasks, knowledge, people operations, and admin controls in one product.'], ['How is TriCord different from chat apps?', 'TriCord starts from posts instead of endless channels. Each post keeps the conversation, files, decisions, tasks, and context together.'], ['Can I use TriCord with clients or guests?', 'Yes. Guests can be invited into specific rooms so external collaborators only see the work meant for them.'], ['Is TriCord ready for HR and payroll compliance?', 'TriCord includes workforce workflows, payroll previews, and records management for beta use. Full country-specific compliance should be reviewed before replacing payroll software.'], ['Where do users sign in?', 'Use the Get Started button to open the app. Owners, Admins, Members, and Guests all sign in from the same product entry point.']];
  return <section id="faq" className="bg-[#FFFDF9] py-20 sm:py-24"><div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8"><div className="text-center"><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">FAQ</p><h2 className="mt-4 text-4xl font-black tracking-normal sm:text-5xl">Questions before you start?</h2></div><div className="mt-10 divide-y divide-[#E5DED4] rounded-xl border border-[#E5DED4] bg-white">{faqs.map(([question, answer]) => <details key={question} className="group p-6"><summary className="cursor-pointer list-none text-lg font-black marker:hidden">{question}</summary><p className="mt-3 leading-7 text-[#635B6C]">{answer}</p></details>)}</div></div></section>;
}

function FinalCTA({ appUrl, onLaunch }: { appUrl: string; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return <section className="bg-[#F97316] py-16 text-[#431407]"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8"><div><h2 className="text-3xl font-black tracking-normal sm:text-4xl">Ready to give your team one place to work?</h2><p className="mt-3 max-w-2xl text-lg leading-8 text-[#5B1B06]">Start a Hub, invite your team, and see how much smoother work feels when the conversation and execution stay connected.</p></div><a href={appUrl} onClick={onLaunch} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#17151D] px-5 text-sm font-bold text-white shadow-lg shadow-[#431407]/18">Get started <ArrowRight className="h-4 w-4" /></a></div></section>;
}

function MarketingFooter({ appUrl, onLaunch }: { appUrl: string; onLaunch: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return <footer className="bg-[#17151D] py-12 text-white"><div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] lg:px-8"><div><div className="flex items-center gap-3"><BrandMark /><span className="text-xl font-black">TriCord</span></div><p className="mt-4 max-w-sm text-sm leading-6 text-white/62">A modern collaboration hub for conversations, projects, knowledge, and business operations.</p><p className="mt-4 text-sm text-white/62">Contact: hello@tricord.app</p></div><FooterColumn title="Product" links={[['Features', '#features'], ['Pricing', '#pricing'], ['Security', '#security'], ['Get started', appUrl]]} onLaunch={onLaunch} appUrl={appUrl} /><FooterColumn title="Resources" links={[['How it works', '#how-it-works'], ['Use cases', '#main'], ['FAQ', '#faq'], ['Help center', '#faq']]} onLaunch={onLaunch} appUrl={appUrl} /><FooterColumn title="Company" links={[['Privacy', '#security'], ['Terms', '#pricing'], ['Status', '#security'], ['LinkedIn', '#top']]} onLaunch={onLaunch} appUrl={appUrl} /></div><div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 px-4 pt-6 text-xs text-white/50 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8"><p>© {new Date().getFullYear()} TriCord. All rights reserved.</p><p>Built for public beta. HR and payroll workflows should be reviewed for local compliance before production use.</p></div></footer>;
}

function MarketingButton({ href, onClick, children }: { href: string; onClick: (event: MouseEvent<HTMLAnchorElement>) => void; children: ReactNode }) {
  return <a href={href} onClick={onClick} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#F97316] px-5 text-sm font-black text-[#431407] shadow-lg shadow-[#C2410C]/24 transition hover:bg-[#FDBA74]">{children}</a>;
}

function MarketingSection({ id, eyebrow, title, body, children }: { id?: string; eyebrow: string; title: string; body: string; children: ReactNode }) {
  return <section id={id} className="bg-[#F7F5F2] py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mb-10 max-w-3xl"><p className="text-sm font-black uppercase tracking-[0.22em] text-[#C2410C]">{eyebrow}</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-normal sm:text-5xl">{title}</h2><p className="mt-5 text-lg leading-8 text-[#635B6C]">{body}</p></div>{children}</div></section>;
}

function renderMarketingCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return <article key={title} className="rounded-xl border border-[#E5DED4] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FFEDD5] text-[#C2410C]"><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-3 leading-7 text-[#635B6C]">{body}</p></article>;
}

function ProductBackdrop() {
  return <div aria-hidden="true" className="absolute inset-0 opacity-55"><div className="absolute right-[-120px] top-12 hidden w-[760px] rotate-[-3deg] rounded-2xl border border-white/12 bg-white/8 p-4 shadow-2xl backdrop-blur-md lg:block"><ProductMockup compact /></div><div className="absolute inset-0 bg-[linear-gradient(90deg,#17151D_0%,rgba(23,21,29,0.92)_42%,rgba(23,21,29,0.54)_100%)]" /></div>;
}

function ProductMockup({ compact = false }: { compact?: boolean }) {
  return <div className={cn('overflow-hidden rounded-2xl border border-[#E5DED4] bg-white shadow-2xl shadow-[#17151D]/10', compact && 'border-white/15 bg-white/12 text-white')}><div className={cn('flex items-center justify-between border-b px-4 py-3', compact ? 'border-white/12' : 'border-[#E5DED4]')}><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#F97316]" /><span className="h-3 w-3 rounded-full bg-[#FDBA74]" /><span className="h-3 w-3 rounded-full bg-[#0D9488]" /></div><span className={cn('text-xs font-bold', compact ? 'text-white/60' : 'text-[#7A7183]')}>TriCord Hub</span></div><div className="grid min-h-[360px] grid-cols-[170px_minmax(0,1fr)]"><aside className={cn('border-r p-4', compact ? 'border-white/12 bg-white/6' : 'border-[#E5DED4] bg-[#F7F5F2]')}><div className="mb-5 flex items-center gap-2"><BrandMark small /><strong>TriCord</strong></div>{['Active Feed', 'Tasks', 'Knowledge', 'Timekeeping'].map((item, index) => <div key={item} className={cn('mb-2 rounded-lg px-3 py-2 text-sm font-bold', index === 0 ? 'bg-[#FFEDD5] text-[#C2410C]' : compact ? 'text-white/60' : 'text-[#6B6274]')}>{item}</div>)}</aside><div className="p-4"><div className="mb-4 flex items-center justify-between"><div><p className={cn('text-xs font-black uppercase tracking-[0.18em]', compact ? 'text-white/50' : 'text-[#7A7183]')}>Hub</p><h3 className="text-2xl font-black">CarePro VA</h3></div><span className="rounded-lg bg-[#17151D] px-3 py-2 text-xs font-bold text-white">New post</span></div><div className="grid gap-3 sm:grid-cols-3">{['Open posts', 'Knowledge', 'Open tasks'].map((label, index) => <div key={label} className={cn('rounded-xl border p-4', compact ? 'border-white/12 bg-white/8' : 'border-[#E5DED4] bg-[#FFFDF9]')}><p className={cn('text-xs font-black uppercase tracking-[0.14em]', compact ? 'text-white/52' : 'text-[#7A7183]')}>{label}</p><strong className="mt-2 block text-2xl">{[18, 12, 7][index]}</strong></div>)}</div><div className={cn('mt-4 rounded-xl border p-4', compact ? 'border-[#FDBA74]/80 bg-white/10' : 'border-[#F97316] bg-[#FFF8F1]')}><div className="flex gap-2"><span className="rounded-full bg-[#DBEAFE] px-2 py-1 text-xs font-bold text-[#1D4ED8]">Active</span><span className="rounded-full bg-[#CCFBF1] px-2 py-1 text-xs font-bold text-[#0F766E]">Client onboarding</span></div><h4 className="mt-4 text-xl font-black">Refine invite flow before launch</h4><p className={cn('mt-2 text-sm leading-6', compact ? 'text-white/68' : 'text-[#635B6C]')}>Keep the experience direct, welcoming, and easy to understand for every role.</p><div className="mt-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFEDD5] text-sm font-black text-[#C2410C]">S</span><span className="text-sm font-bold">Sheena</span></div></div></div></div></div>;
}

function VideoMockup() {
  return <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/8 shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><span className="text-sm font-black">60-second product walkthrough</span><span className="rounded-full bg-[#F97316] px-3 py-1 text-xs font-black text-[#431407]">Preview</span></div><div className="grid gap-4 p-5 sm:grid-cols-[1fr_180px]"><div className="grid min-h-72 place-items-center rounded-xl border border-white/10 bg-[#0C0B10]"><button className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F97316] text-[#431407] shadow-xl" aria-label="Play product walkthrough"><ArrowRight className="h-7 w-7" /></button></div><div className="space-y-3 text-sm text-white/70">{['Create a focused post', 'Assign tasks from discussion', 'Save answers to knowledge', 'Review team operations'].map((item) => <div key={item} className="rounded-lg border border-white/10 bg-white/8 p-3"><CheckCircle2 className="mb-2 h-4 w-4 text-[#FDBA74]" />{item}</div>)}</div></div></div>;
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
