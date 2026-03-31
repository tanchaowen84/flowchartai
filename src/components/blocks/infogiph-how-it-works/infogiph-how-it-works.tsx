import { MousePointer2, Paintbrush, Share, Type } from 'lucide-react';

export function InfogiphHowItWorks() {
  return (
    <section className="w-full py-32 bg-[#F6F8F3] overflow-hidden">
      <div className="container px-4 md:px-6 max-w-6xl mx-auto flex flex-col gap-40">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-6xl font-bold text-[#484848]">
            How it works
          </h2>
        </div>

        {/* Step 1 */}
        <div className="flex flex-col md:flex-row items-center gap-16 md:gap-32">
          {/* Text Content */}
          <div className="w-full md:w-1/2 flex flex-col items-start relative z-10">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#484848] text-white flex items-center justify-center text-2xl font-bold font-mono">
                1
              </div>
              <h3 className="text-3xl md:text-5xl font-bold text-[#484848] leading-[1.2]">
                Start by
                <br />
                <span className="text-[#81CF33] relative inline-block">
                  Importing
                  {/* Wavy underline */}
                  <svg
                    className="absolute w-full h-3 -bottom-1 left-0 text-[#81CF33]"
                    viewBox="0 0 100 20"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0 10 Q 25 20, 50 10 T 100 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                  </svg>
                </span>{' '}
                or
                <br />
                <span className="text-[#81CF33]">Pasting</span> your text
              </h3>
            </div>
            <p className="text-lg text-[#484848] mt-6 ml-16">
              Forget prompting, Infogiph works directly from your text.
            </p>
          </div>

          {/* Visual Element */}
          <div className="w-full md:w-1/2 relative h-[400px]">
            {/* Background decorative circles */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full border-[40px] border-[#E8F5E9] z-0"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full border-[40px] border-[#F1F8E9] z-0 opacity-50"></div>

            {/* Mock Editor Card */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px] bg-white rounded-xl shadow-xl border border-gray-100 p-8 z-10">
              <div className="flex items-center gap-2 mb-6 border-b pb-4">
                <Type className="w-5 h-5 text-gray-400" />
                <div className="h-4 bg-gray-100 rounded w-1/3"></div>
              </div>
              <div className="space-y-4">
                <div className="h-3 bg-gray-100 rounded w-full"></div>
                <div className="h-3 bg-gray-100 rounded w-5/6"></div>
                <div className="h-3 bg-gray-100 rounded w-4/6"></div>
                <div className="h-3 bg-gray-100 rounded w-full mt-6"></div>
                <div className="h-3 bg-gray-100 rounded w-3/4"></div>
              </div>
              <div className="absolute -bottom-6 -right-6 bg-white p-3 rounded-xl shadow-lg border border-gray-50 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">
                  Ctrl + V
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-16 md:gap-32">
          {/* Text Content */}
          <div className="w-full md:w-1/2 flex flex-col items-start relative z-10">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#484848] text-white flex items-center justify-center text-2xl font-bold font-mono">
                2
              </div>
              <h3 className="text-3xl md:text-5xl font-bold text-[#484848] leading-[1.2]">
                <span className="text-[#1AC6FF]">Click</span> to
                <br />
                generate visuals
              </h3>
            </div>
            <p className="text-lg text-[#484848] mt-6 ml-16">
              Infogiph generates the most relevant visuals based on your text,
              then you pick the one that best expresses what you have in mind.
            </p>
          </div>

          {/* Visual Element */}
          <div className="w-full md:w-1/2 relative h-[400px]">
            {/* Background decorative blobs */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-64 bg-[#E6F7FF] rounded-full blur-xl z-0 transform -rotate-45"></div>
            <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#F0F9FF] rounded-full blur-2xl z-0"></div>

            {/* Mock Interaction */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[380px] z-10">
              <div className="bg-white rounded-lg shadow-lg border border-blue-50 p-6 relative">
                <p className="text-gray-400 font-serif text-lg leading-relaxed mb-4">
                  Project Resource Allocation
                  <br />
                  <br />
                  Research: Design (120h), Development (80h)...
                </p>

                {/* Hover visual spark */}
                <div className="absolute -left-4 top-1/2 -translate-y-1/2 bg-[#1AC6FF] text-white rounded-full p-2 shadow-md flex items-center justify-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
                  </svg>
                </div>

                <div className="absolute bottom-[-20px] right-[-20px]">
                  <MousePointer2 className="w-10 h-10 text-gray-800 fill-white transform -rotate-12" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex flex-col md:flex-row items-center gap-16 md:gap-32">
          {/* Text Content */}
          <div className="w-full md:w-1/2 flex flex-col items-start relative z-10">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#484848] text-white flex items-center justify-center text-2xl font-bold font-mono">
                3
              </div>
              <h3 className="text-3xl md:text-5xl font-bold text-[#484848] leading-[1.2]">
                <span className="text-[#F6AD55]">Polish</span> it up,
                <br />
                make it yours
              </h3>
            </div>
            <p className="text-lg text-[#484848] mt-6 ml-16">
              Infogiph visuals are fully editable, so you can adjust content and
              style to maximize their impact.
            </p>
          </div>

          {/* Visual Element */}
          <div className="w-full md:w-1/2 grid grid-cols-2 gap-4 relative z-10">
            {/* Background shape */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#FFF5F5] to-transparent rounded-3xl -z-10 scale-110 transform rotate-3"></div>

            {/* Style Cards */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M12 6V18M6 12H18"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <h4 className="font-bold text-lg text-gray-800">Icons</h4>
              <p className="text-sm text-gray-500">
                Add or swap icons from our database.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 translate-y-8">
              <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white"
                >
                  <path
                    d="M3 3H21M3 21H21M3 12H21"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <h4 className="font-bold text-lg text-gray-800">Connectors</h4>
              <p className="text-sm text-gray-500">
                Dynamic lines that connect anything.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center">
                <Paintbrush className="w-5 h-5 text-white" />
              </div>
              <h4 className="font-bold text-lg text-gray-800">Colors</h4>
              <p className="text-sm text-gray-500">
                Look good on light or dark modes.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 translate-y-8">
              <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center">
                <Type className="w-5 h-5 text-white" />
              </div>
              <h4 className="font-bold text-lg text-gray-800">Fonts</h4>
              <p className="text-sm text-gray-500">
                Kept simple: casual or formal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
