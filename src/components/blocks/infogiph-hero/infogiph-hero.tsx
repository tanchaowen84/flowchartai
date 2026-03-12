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
        <h1 className="text-5xl md:text-7xl lg:text-[80px] font-bold text-[#484848] leading-[1.1] md:leading-[1.1] tracking-tight mb-8">
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
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            {/* Input Column */}
            <div className="flex flex-col gap-6 w-full md:w-auto">
              {/* Notes Node */}
              <div className="relative flex items-center justify-center bg-white border-2 border-[#FC8181] rounded-lg px-6 py-4 shadow-sm z-10">
                <span className="text-[#FC8181] font-medium mr-2">Notes</span>
                <FileText className="w-5 h-5 text-[#FC8181]" />
                {/* Connecting Line */}
                <svg
                  className="absolute top-1/2 -right-16 md:-right-[4.5rem] w-16 md:w-[4.5rem] h-px hidden md:block"
                  overflow="visible"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="100%"
                    y2="0"
                    stroke="#CBD5E1"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                </svg>
              </div>

              {/* Blogs Node */}
              <div className="relative flex items-center justify-center w-48 bg-white border-2 border-[#B794F4] rounded-lg px-6 py-4 shadow-sm z-10 md:mr-12">
                <span className="text-[#B794F4] font-medium mr-2">Blogs</span>
                <PenTool className="w-5 h-5 text-[#B794F4]" />
                {/* Connecting Line angled up */}
                <svg
                  className="absolute -top-[1.2rem] -right-[3rem] w-16 h-12 hidden md:block"
                  overflow="visible"
                >
                  <path
                    d="M0 48 C 30 48, 30 0, 64 0"
                    fill="none"
                    className="stroke-[#CBD5E1]"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                </svg>
              </div>

              {/* Wikis Node */}
              <div className="relative flex items-center justify-center bg-white border-2 border-[#F6E05E] rounded-lg px-6 py-4 shadow-sm z-10 md:ml-12 w-40">
                <span className="text-[#D69E2E] font-medium mr-2">Wikis</span>
                <Globe className="w-5 h-5 text-[#D69E2E]" />
                {/* Connecting Line angled down */}
                <svg
                  className="absolute -top-[3.5rem] -left-[2.5rem] w-16 h-16 hidden md:block z-0"
                  overflow="visible"
                >
                  <path
                    d="M0 0 C 20 0, 20 64, 50 64"
                    fill="none"
                    className="stroke-[#CBD5E1]"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                </svg>
              </div>
            </div>

            {/* Central Node */}
            <div className="relative flex flex-col items-center justify-center bg-white border-2 border-[#A0AEC0] rounded-xl px-8 py-6 shadow-sm z-20 w-40 h-40">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mb-2 text-[#4A5568]"
              >
                <path
                  d="M5 3L19 12L5 21V3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[#4A5568] font-medium text-center leading-tight">
                Infogiph
                <br />
                Boosts
              </span>
            </div>

            {/* Output Column */}
            <div className="flex flex-col gap-6 w-full md:w-auto">
              {/* Presentations Node */}
              <div className="relative flex items-center justify-center bg-[#fef7f0] border-2 border-[#F6AD55] rounded-lg px-6 py-4 shadow-sm z-10 md:ml-8">
                {/* Connecting Line */}
                <svg
                  className="absolute top-1/2 -left-16 md:-left-[4rem] w-16 md:w-[4rem] h-px hidden md:block"
                  overflow="visible"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="100%"
                    y2="0"
                    stroke="#CBD5E1"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                </svg>
                <Layout className="w-5 h-5 text-[#DD6B20] mr-2" />
                <span className="text-[#DD6B20] font-medium">
                  Presentations
                </span>
              </div>

              {/* Documents Node */}
              <div className="relative flex items-center justify-center bg-[#eff9ff] border-2 border-[#4299E1] rounded-lg px-6 py-4 shadow-sm z-10">
                {/* Connecting Line */}
                <svg
                  className="absolute top-1/2 -left-16 md:-left-[2rem] w-16 md:w-[2rem] h-px hidden md:block"
                  overflow="visible"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="100%"
                    y2="0"
                    stroke="#CBD5E1"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                </svg>
                <FileText className="w-5 h-5 text-[#3182CE] mr-2" />
                <span className="text-[#3182CE] font-medium">Documents</span>
              </div>

              {/* Social Medias Node */}
              <div className="relative items-center justify-center bg-[#f2faeb] border-2 border-[#68D391] rounded-lg px-6 py-4 shadow-sm z-10 hidden md:flex md:-mt-64 md:-ml-[48rem]">
                <Share2 className="w-5 h-5 text-[#38A169] mr-2" />
                <span className="text-[#38A169] font-medium">
                  Social Medias
                </span>
                {/* Connecting Line angled back to output side */}
                <svg
                  className="absolute top-1/2 -right-[18rem] w-[18rem] h-px hidden md:block"
                  overflow="visible"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="100%"
                    y2="0"
                    stroke="#CBD5E1"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                </svg>
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
