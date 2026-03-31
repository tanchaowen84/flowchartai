import Link from 'next/link';

export function InfogiphFooter() {
  return (
    <footer className="bg-[#2c2f31] pt-24 pb-12 w-full text-white">
      <div className="container px-4 md:px-6 max-w-6xl mx-auto flex flex-col items-center">
        {/* Top CTA area */}
        <div className="text-center mb-24">
          <h2 className="text-5xl md:text-7xl font-bold mb-8">Try Infogiph!</h2>
          <Link
            href="/canvas"
            className="inline-flex items-center justify-center gap-2 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#334155] font-medium px-6 py-2.5 rounded-md transition-colors duration-200"
          >
            Get Infogiph Free
          </Link>
        </div>

        {/* Footer Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 w-full border-t border-gray-700/50 pt-16 mb-16 px-4">
          {/* Logo Column */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 text-2xl font-bold mb-6">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="text-white"
              >
                <path
                  d="M5 3L19 12L5 21V3Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Infogiph
            </div>
          </div>

          {/* Product Links */}
          <div className="col-span-1 flex flex-col gap-4">
            <h3 className="font-bold text-lg mb-2">Product</h3>
            <Link
              href="#how-it-works"
              className="text-gray-400 hover:text-white transition-colors"
            >
              How it works
            </Link>
            <Link
              href="#use-cases"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Use Cases
            </Link>
            <Link
              href="/pricing"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/help"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Help Center
            </Link>
          </div>

          {/* Company Links */}
          <div className="col-span-1 flex flex-col gap-4">
            <h3 className="font-bold text-lg mb-2">Company</h3>
            <Link
              href="/about"
              className="text-gray-400 hover:text-white transition-colors"
            >
              About us
            </Link>
            <Link
              href="/careers"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Careers
            </Link>
            <Link
              href="/blog"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/contact"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Contact Us
            </Link>
          </div>

          {/* Privacy Links */}
          <div className="col-span-1 flex flex-col gap-4">
            <h3 className="font-bold text-lg mb-2">Privacy</h3>
            <Link
              href="/legal/terms"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Terms and Conditions
            </Link>
            <Link
              href="/legal/privacy"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </div>

        {/* Bottom Copyright */}
        <p className="text-sm text-balance text-muted-foreground">
          © {new Date().getFullYear()} Infogiph Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
