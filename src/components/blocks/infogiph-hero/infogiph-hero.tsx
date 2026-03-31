import {
  ArrowRight,
  FileText,
  Globe,
  Layout,
  PenTool,
  Share2,
} from 'lucide-react';
import Link from 'next/link';

export function InfogiphHero() {
  return (
    <section className="relative w-full overflow-hidden bg-white min-h-[90vh] flex flex-col items-center pt-32 pb-20">
      {/* Subtle dotted background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.15]"
        style={{
          backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 40%, transparent 100%)',
        }}
      />

      <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center max-w-5xl mx-auto">
        <h1 className="text-4xl md:text-5xl lg:text-7xl xl:text-[80px] font-bold text-[#484848] leading-[1.1] md:leading-[1.1] tracking-tight mb-8">
          Make{' '}
          <span className="relative inline-block">
            <span className="relative z-10 px-2">interactive</span>
            <span className="absolute inset-0 bg-[#e6f4ff] rounded-md -z-0"></span>
          </span>
          <br className="hidden md:block" /> infographics for free
        </h1>

        <p className="text-lg md:text-xl text-[#484848] max-w-2xl mx-auto mb-16 font-normal">
          Create stunning <strong>animated infographics</strong> from your text in seconds. Infogiph makes sharing your ideas quick, engaging, and effective.
        </p>

        {/* Hero Visual Mockup */}
        <div className="relative w-full max-w-4xl mx-auto mb-20">
          {/* Mobile & Tablet: simple grid */}
          <div className="grid grid-cols-2 gap-4 lg:hidden">
            <div className="flex items-center justify-center bg-white border-2 border-[#FC8181] rounded-lg px-4 py-3 shadow-sm">
              <span className="text-[#FC8181] font-medium mr-2">Notes</span>
              <FileText className="w-4 h-4 text-[#FC8181]" />
            </div>
            <div className="flex items-center justify-center bg-white border-2 border-[#B794F4] rounded-lg px-4 py-3 shadow-sm">
              <span className="text-[#B794F4] font-medium mr-2">Blogs</span>
              <PenTool className="w-4 h-4 text-[#B794F4]" />
            </div>
            <div className="flex items-center justify-center bg-white border-2 border-[#F6E05E] rounded-lg px-4 py-3 shadow-sm">
              <span className="text-[#D69E2E] font-medium mr-2">Wikis</span>
              <Globe className="w-4 h-4 text-[#D69E2E]" />
            </div>
            <div className="flex items-center justify-center bg-[#f2faeb] border-2 border-[#68D391] rounded-lg px-4 py-3 shadow-sm">
              <Share2 className="w-4 h-4 text-[#38A169] mr-2" />
              <span className="text-[#38A169] font-medium">Social</span>
            </div>
            <div className="col-span-2 flex items-center justify-center bg-white border-2 border-[#A0AEC0] rounded-xl px-6 py-5 shadow-sm">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="mr-3 text-[#4A5568]">
                <path d="M5 3L19 12L5 21V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[#4A5568] font-medium">Infogiph Boosts</span>
            </div>
            <div className="flex items-center justify-center bg-[#fef7f0] border-2 border-[#F6AD55] rounded-lg px-4 py-3 shadow-sm">
              <Layout className="w-4 h-4 text-[#DD6B20] mr-2" />
              <span className="text-[#DD6B20] font-medium text-sm">Presentations</span>
            </div>
            <div className="flex items-center justify-center bg-[#eff9ff] border-2 border-[#4299E1] rounded-lg px-4 py-3 shadow-sm">
              <FileText className="w-4 h-4 text-[#3182CE] mr-2" />
              <span className="text-[#3182CE] font-medium">Documents</span>
            </div>
          </div>

          {/* Desktop: flowchart layout */}
          <div className="hidden lg:flex items-center justify-center gap-6 xl:gap-10">
            {/* Input Column */}
            <div className="flex flex-col items-end gap-5 shrink-0">
              <div className="flex items-center bg-white border-2 border-[#FC8181] rounded-lg px-5 py-3 shadow-sm">
                <span className="text-[#FC8181] font-medium mr-2">Notes</span>
                <FileText className="w-5 h-5 text-[#FC8181]" />
              </div>
              <div className="flex items-center bg-white border-2 border-[#B794F4] rounded-lg px-5 py-3 shadow-sm">
                <span className="text-[#B794F4] font-medium mr-2">Blogs</span>
                <PenTool className="w-5 h-5 text-[#B794F4]" />
              </div>
              <div className="flex items-center bg-white border-2 border-[#F6E05E] rounded-lg px-5 py-3 shadow-sm">
                <span className="text-[#D69E2E] font-medium mr-2">Wikis</span>
                <Globe className="w-5 h-5 text-[#D69E2E]" />
              </div>
              <div className="flex items-center bg-[#f2faeb] border-2 border-[#68D391] rounded-lg px-5 py-3 shadow-sm">
                <Share2 className="w-5 h-5 text-[#38A169] mr-2" />
                <span className="text-[#38A169] font-medium">Social Media</span>
              </div>
            </div>

            {/* Connecting arrows left */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <svg width="60" height="160" viewBox="0 0 60 160" fill="none" className="text-[#CBD5E1]">
                <path d="M0 20 Q30 20 55 80" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                <path d="M0 60 Q30 60 55 80" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                <path d="M0 100 Q30 100 55 80" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                <path d="M0 140 Q30 140 55 80" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" fill="none" />
              </svg>
            </div>

            {/* Central Node */}
            <div className="flex flex-col items-center justify-center bg-white border-2 border-[#A0AEC0] rounded-xl px-8 py-6 shadow-sm shrink-0 w-36 h-36">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="mb-2 text-[#4A5568]">
                <path d="M5 3L19 12L5 21V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[#4A5568] font-medium text-center leading-tight">
                Infogiph<br />Boosts
              </span>
            </div>

            {/* Connecting arrows right */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <svg width="60" height="120" viewBox="0 0 60 120" fill="none" className="text-[#CBD5E1]">
                <path d="M5 60 Q30 60 55 30" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                <path d="M5 60 Q30 60 55 90" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" fill="none" />
              </svg>
            </div>

            {/* Output Column */}
            <div className="flex flex-col items-start gap-5 shrink-0">
              <div className="flex items-center bg-[#fef7f0] border-2 border-[#F6AD55] rounded-lg px-5 py-3 shadow-sm">
                <Layout className="w-5 h-5 text-[#DD6B20] mr-2" />
                <span className="text-[#DD6B20] font-medium">Presentations</span>
              </div>
              <div className="flex items-center bg-[#eff9ff] border-2 border-[#4299E1] rounded-lg px-5 py-3 shadow-sm">
                <FileText className="w-5 h-5 text-[#3182CE] mr-2" />
                <span className="text-[#3182CE] font-medium">Documents</span>
              </div>
            </div>
          </div>
        </div>

        <Link
          href="/canvas"
          className="inline-flex items-center justify-center gap-2 bg-[#30363c] hover:bg-[#434b53] text-white text-lg font-medium px-8 py-4 rounded-md transition-colors duration-200 group"
        >
          Get Infogiph Free
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </section>
  );
}
