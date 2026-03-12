'use client';

import { ChevronLeft, ChevronRight, Star, Sun } from 'lucide-react';
import { useState } from 'react';

const TESTIMONIALS = [
  {
    quote:
      "Infogiph allows me to visualize ideas in seconds. It's transformed how I present my marketing plans.",
    author: 'Sarah J.',
    role: 'Marketing Director',
  },
  {
    quote:
      'I used to spend hours aligning boxes in PPT. Infogiph automates the whole process beautifully.',
    author: 'David L.',
    role: 'Product Manager',
  },
  {
    quote:
      'The ability to just type and see a flowchart appear is pure magic. Highly recommend.',
    author: 'Emily R.',
    role: 'Technical Writer',
  },
];

export function InfogiphTestimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length
    );
  };

  return (
    <section className="w-full py-24 bg-[#FAF9F6] border-y border-gray-100">
      <div className="container px-4 md:px-6 max-w-6xl mx-auto flex flex-col items-center">
        {/* Gallery Section Header */}
        <div className="flex items-center gap-3 mb-12">
          <Sun className="w-8 h-8 text-yellow-400 fill-yellow-400" />
          <h2 className="text-3xl md:text-4xl font-bold text-[#484848]">
            Gallery
          </h2>
        </div>

        {/* Gallery Grid (Simplified Mock) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-32">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm border border-gray-100 h-64 flex flex-col items-center justify-center p-6 hover:shadow-md transition-shadow"
            >
              <div className="w-full h-full border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50">
                <span className="text-gray-400 font-medium">
                  Sample Diagram {i}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials Section */}
        <div className="w-full max-w-4xl mx-auto text-center relative">
          <h2 className="text-4xl md:text-5xl font-bold text-[#484848] mb-16 relative inline-block">
            Don't take our{' '}
            <span className="relative">
              word
              {/* Wavy underline */}
              <svg
                className="absolute w-full h-3 -bottom-2 left-0 text-gray-300"
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
            for it.
          </h2>

          <div className="bg-white rounded-3xl p-10 md:p-16 shadow-xl border border-gray-100 relative mt-8">
            {/* Slider Controls */}
            <button
              onClick={prevTestimonial}
              className="absolute left-0 md:-left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center text-gray-600 hover:text-black hover:scale-105 transition-all z-10"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              onClick={nextTestimonial}
              className="absolute right-0 md:-right-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center text-gray-600 hover:text-black hover:scale-105 transition-all z-10"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Content */}
            <div className="flex flex-col items-center min-h-[160px] justify-center transition-opacity duration-300">
              <div className="flex gap-1 mb-6">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className="w-5 h-5 text-yellow-400 fill-yellow-400"
                  />
                ))}
              </div>
              <p className="text-2xl md:text-3xl text-gray-800 font-medium leading-relaxed mb-8 max-w-2xl mx-auto">
                "{TESTIMONIALS[currentIndex].quote}"
              </p>
              <div>
                <h4 className="font-bold text-gray-900">
                  {TESTIMONIALS[currentIndex].author}
                </h4>
                <p className="text-gray-500 text-sm">
                  {TESTIMONIALS[currentIndex].role}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
