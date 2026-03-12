import { FileText, Layout, MessageSquare, Presentation } from 'lucide-react';

export function InfogiphUseCases() {
  return (
    <section className="w-full py-24 bg-white">
      <div className="container px-4 md:px-6 max-w-6xl mx-auto flex flex-col items-center">
        <h2 className="text-4xl md:text-5xl font-bold text-[#484848] mb-16 text-center">
          Use cases
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {/* Presentations */}
          <div className="bg-[#FCF1E6] rounded-3xl p-10 flex flex-col justify-between min-h-[400px] border border-orange-50 group hover:-translate-y-1 transition-transform duration-300">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-bold text-[#484848]">
                  Presentations
                </span>
              </div>
              <p className="text-[#484848] text-lg font-medium">
                Make impactful slides
              </p>
            </div>

            {/* Mock Visual */}
            <div className="mt-8 relative">
              <div className="w-full h-48 bg-white/60 rounded-xl shadow-sm border border-orange-100 flex items-center justify-center">
                <Presentation className="w-16 h-16 text-[#DD6B20] opacity-50 group-hover:scale-110 transition-transform duration-500" />
              </div>
              {/* Integration integrations */}
              <div className="absolute -bottom-4 right-4 flex space-x-2">
                <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center p-2">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/1/1e/Google_Slides_logo_%282014-2020%29.svg"
                    alt="Google Slides"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="w-10 h-10 rounded-full bg-orange-600 shadow-md flex items-center justify-center p-2 text-white font-bold text-xs">
                  PPT
                </div>
              </div>
            </div>
          </div>

          {/* Blogs */}
          <div className="bg-[#F3EBF9] rounded-3xl p-10 flex flex-col justify-between min-h-[400px] border border-purple-50 group hover:-translate-y-1 transition-transform duration-300">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-bold text-[#484848]">Blog</span>
              </div>
              <p className="text-[#484848] text-lg font-medium">
                Leave an impression
              </p>
            </div>

            {/* Mock Visual */}
            <div className="mt-8 relative">
              <div className="w-full h-48 bg-white/60 rounded-xl shadow-sm border border-purple-100 flex items-center justify-center">
                <MessageSquare className="w-16 h-16 text-[#9F7AEA] opacity-50 group-hover:scale-110 transition-transform duration-500" />
              </div>
              {/* Integration */}
              <div className="absolute -bottom-4 right-4 flex space-x-2">
                <div className="w-10 h-10 rounded-full bg-black shadow-md flex items-center justify-center text-white">
                  <svg
                    viewBox="0 0 1043.63 592.71"
                    className="w-6 h-6 fill-current"
                  >
                    <g data-name="Layer 2">
                      <g data-name="Layer 1">
                        <path d="M588.67 296.36c0 163.67-131.78 296.35-294.33 296.35S0 460 0 296.36 131.78 0 294.34 0s294.33 132.69 294.33 296.36M911.56 296.36c0 154.06-65.89 279-147.17 279s-147.17-124.94-147.17-279 65.88-279 147.16-279 147.17 124.9 147.17 279M1043.63 296.36c0 138-23.17 249.94-51.76 249.94s-51.75-111.91-51.75-249.94 23.17-249.94 51.75-249.94 51.76 111.9 51.76 249.94"></path>
                      </g>
                    </g>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div className="bg-[#EBF7E6] rounded-3xl p-10 flex flex-col justify-between min-h-[400px] border border-green-50 group hover:-translate-y-1 transition-transform duration-300">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-bold text-[#484848]">
                  Social Media
                </span>
              </div>
              <p className="text-[#484848] text-lg font-medium">
                Engage your audience
              </p>
            </div>

            {/* Mock Visual */}
            <div className="mt-8 relative">
              <div className="w-full h-48 bg-white/60 rounded-xl shadow-sm border border-green-100 flex items-center justify-center">
                <Layout className="w-16 h-16 text-[#48BB78] opacity-50 group-hover:scale-110 transition-transform duration-500" />
              </div>
              {/* Integration */}
              <div className="absolute -bottom-4 right-4 flex space-x-2">
                <div className="w-10 h-10 rounded-full bg-[#0077b5] shadow-md flex items-center justify-center text-white font-bold text-sm">
                  in
                </div>
                <div className="w-10 h-10 rounded-full bg-black shadow-md flex items-center justify-center p-2 text-white">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Docs */}
          <div className="bg-[#E1F4FD] rounded-3xl p-10 flex flex-col justify-between min-h-[400px] border border-blue-50 group hover:-translate-y-1 transition-transform duration-300">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-bold text-[#484848]">Docs</span>
              </div>
              <p className="text-[#484848] text-lg font-medium">
                Write easy to read docs
              </p>
            </div>

            {/* Mock Visual */}
            <div className="mt-8 relative">
              <div className="w-full h-48 bg-white/60 rounded-xl shadow-sm border border-blue-100 flex items-center justify-center">
                <FileText className="w-16 h-16 text-[#4299E1] opacity-50 group-hover:scale-110 transition-transform duration-500" />
              </div>
              {/* Integration */}
              <div className="absolute -bottom-4 right-4 flex space-x-2">
                <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center p-2">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/e/e1/Google_Docs_logo_%282014-2020%29.svg"
                    alt="Google Docs"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
