'use client';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Pause, Play, RotateCcw, Settings, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ExcalidrawAnimateWrapperProps {
  excalidrawData: string;
}

const ExcalidrawAnimateWrapper: React.FC<ExcalidrawAnimateWrapperProps> = ({
  excalidrawData,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState([1]);
  const [showControls, setShowControls] = useState(true);
  const [animationInstance, setAnimationInstance] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeAnimation = async () => {
      try {
        if (!containerRef.current) return;

        // Parse the Excalidraw data
        console.log('Raw excalidrawData length:', excalidrawData?.length);
        console.log(
          'Raw excalidrawData preview:',
          excalidrawData?.substring(0, 200)
        );

        const parsedData = JSON.parse(excalidrawData);
        console.log('Parsed animation data:', parsedData);
        console.log('Elements count:', parsedData.elements?.length);

        // Log some elements details
        if (parsedData.elements && parsedData.elements.length > 0) {
          console.log('First few elements:', parsedData.elements.slice(0, 3));
          console.log(
            'Elements types:',
            parsedData.elements.map((el: any) => el.type)
          );
        }

        // Dynamic import to avoid SSR issues
        const { exportToSvg } = await import('@excalidraw/excalidraw');
        const { animateSvg } = await import('excalidraw-animate');

        // Clear the container
        containerRef.current.innerHTML = '';

        // Check if we have elements to animate
        if (!parsedData.elements || parsedData.elements.length === 0) {
          throw new Error('No elements found in the flowchart data');
        }

        console.log('Exporting to SVG...');

        // Convert Excalidraw elements to SVG
        const svgElement = await exportToSvg({
          elements: parsedData.elements,
          appState: parsedData.appState || {},
          files: parsedData.files || {},
        });

        console.log('SVG created:', svgElement);
        console.log('SVG innerHTML length:', svgElement.innerHTML?.length);
        console.log(
          'SVG outerHTML preview:',
          svgElement.outerHTML?.substring(0, 500)
        );

        // Add SVG to container
        containerRef.current.appendChild(svgElement);
        console.log('SVG appended to container successfully');

        // Try to initialize the animation on the SVG
        try {
          console.log(
            'Attempting to animate SVG with elements:',
            parsedData.elements
          );
          const animationResult = animateSvg(svgElement, parsedData.elements, {
            startMs: 0,
          });

          console.log('Animation result:', animationResult);

          if (mounted) {
            setAnimationInstance({
              svg: svgElement,
              finishedMs: animationResult.finishedMs,
              play: () => {
                // SVG animations start automatically, but we can control them via CSS
                svgElement.style.animationPlayState = 'running';
              },
              pause: () => {
                svgElement.style.animationPlayState = 'paused';
              },
              restart: () => {
                svgElement.style.animation = 'none';
                svgElement.offsetHeight; // Trigger reflow
                svgElement.style.animation = null;
              },
              setSpeed: (speed: number) => {
                svgElement.style.animationDuration = `${animationResult.finishedMs / speed}ms`;
              },
            });
            setError(null);
          }
        } catch (animError) {
          console.warn('Animation failed, showing static SVG:', animError);

          // If animation fails, at least show the static SVG
          if (mounted) {
            setAnimationInstance({
              svg: svgElement,
              finishedMs: 0,
              play: () => console.log('Static mode - no animation available'),
              pause: () => console.log('Static mode - no animation available'),
              restart: () =>
                console.log('Static mode - no animation available'),
              setSpeed: () =>
                console.log('Static mode - no animation available'),
            });
            setError(null);
          }
        }
      } catch (error) {
        console.error('Error initializing animation:', error);
        if (mounted) {
          setError(
            'Failed to initialize animation. Please check the flowchart data.'
          );
        }
      }
    };

    initializeAnimation();

    return () => {
      mounted = false;
    };
  }, [excalidrawData, animationSpeed]);

  const handlePlay = () => {
    if (animationInstance) {
      animationInstance.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (animationInstance) {
      animationInstance.pause();
      setIsPlaying(false);
    }
  };

  const handleRestart = () => {
    if (animationInstance) {
      animationInstance.restart();
      setIsPlaying(true);
    }
  };

  const handleSpeedChange = (value: number[]) => {
    setAnimationSpeed(value);
    if (animationInstance) {
      animationInstance.setSpeed(value[0]);
    }
  };

  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else {
      // Fallback for when opened directly
      window.history.back();
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-100">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Animation Error
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={handleClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-white relative">
      {/* Debug Info */}
      <div className="absolute top-16 left-4 bg-yellow-100 p-2 text-xs border rounded z-10">
        Debug: excalidrawData length = {excalidrawData?.length || 0}
        {animationInstance && <div>Animation instance exists</div>}
      </div>

      {/* Animation Container */}
      <div
        ref={containerRef}
        className="flex-1 w-full h-full bg-gray-50 border-2 border-dashed border-gray-300"
        style={{ minHeight: '600px' }}
      />

      {/* Control Panel */}
      {showControls && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border p-4">
          <div className="flex items-center gap-4">
            {/* Play/Pause Button */}
            <Button
              onClick={isPlaying ? handlePause : handlePlay}
              size="sm"
              className="w-10 h-10 rounded-full"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            {/* Restart Button */}
            <Button onClick={handleRestart} size="sm" variant="outline">
              <RotateCcw className="h-4 w-4" />
            </Button>

            {/* Speed Control */}
            <div className="flex items-center gap-2 min-w-[120px]">
              <Settings className="h-4 w-4 text-gray-500" />
              <Slider
                value={animationSpeed}
                onValueChange={handleSpeedChange}
                max={3}
                min={0.1}
                step={0.1}
                className="flex-1"
              />
              <span className="text-sm text-gray-600 min-w-[32px]">
                {animationSpeed[0]}x
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Close Button */}
      <Button
        onClick={handleClose}
        size="sm"
        variant="ghost"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/80 hover:bg-white"
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Toggle Controls Button */}
      <Button
        onClick={() => setShowControls(!showControls)}
        size="sm"
        variant="ghost"
        className="absolute top-4 left-4 bg-white/80 hover:bg-white"
      >
        {showControls ? 'Hide Controls' : 'Show Controls'}
      </Button>
    </div>
  );
};

export default ExcalidrawAnimateWrapper;
