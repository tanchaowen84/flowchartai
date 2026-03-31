'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

// Dynamic import for the animation component to avoid SSR issues
const ExcalidrawAnimateWrapper = dynamic(
  () => import('@/components/animate/excalidraw-animate-wrapper'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <div className="text-lg text-gray-600">Loading Animation...</div>
        </div>
      </div>
    ),
  }
);

function AnimatePageContent() {
  const searchParams = useSearchParams();
  const [excalidrawData, setExcalidrawData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = searchParams.get('key');
    const data = searchParams.get('data'); // Fallback for old URLs

    let excalidrawJson = null;

    // Try to get data from localStorage first (new method)
    if (key) {
      try {
        console.log('Looking for animation data with key:', key);
        const storedData = localStorage.getItem(key);
        console.log('Found stored data:', storedData ? 'Yes' : 'No');
        if (storedData) {
          excalidrawJson = storedData;
          console.log('Retrieved data length:', storedData.length);
          console.log('Retrieved data preview:', storedData.substring(0, 200));
          // Clean up localStorage after reading
          localStorage.removeItem(key);
        } else {
          console.error('No data found for key:', key);
          setError(
            'Animation data not found. Please try generating the animation again.'
          );
          return;
        }
      } catch (error) {
        console.error('Error reading from localStorage:', error);
        setError('Failed to load animation data');
        return;
      }
    }
    // Fallback to URL parameter method (for backward compatibility)
    else if (data) {
      try {
        excalidrawJson = atob(data);
      } catch (error) {
        console.error('Error decoding URL data:', error);
        setError('Invalid animation data format');
        return;
      }
    } else {
      setError('No flowchart data provided for animation');
      return;
    }

    try {
      const parsedData = JSON.parse(excalidrawJson);

      // Validate that it's proper Excalidraw data
      if (!parsedData.elements || !Array.isArray(parsedData.elements)) {
        throw new Error('Invalid Excalidraw data format');
      }

      setExcalidrawData(excalidrawJson);
    } catch (error) {
      console.error('Error parsing flowchart data:', error);
      setError('Invalid flowchart data format');
    }
  }, [searchParams]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-100">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Animation Error
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!excalidrawData) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <div className="text-lg text-gray-600">Loading flowchart data...</div>
        </div>
      </div>
    );
  }

  return <ExcalidrawAnimateWrapper excalidrawData={excalidrawData} />;
}

export default function AnimatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen w-screen bg-gray-100">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            <div className="text-lg text-gray-600">Loading...</div>
          </div>
        </div>
      }
    >
      <AnimatePageContent />
    </Suspense>
  );
}
