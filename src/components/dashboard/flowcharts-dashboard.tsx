'use client';

import { AIUsageLimitCard } from '@/components/shared/ai-usage-limit-card';
import { GuestUsageIndicator } from '@/components/shared/guest-usage-indicator';
import { PricingModal } from '@/components/shared/pricing-modal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAIUsageLimit } from '@/hooks/use-ai-usage-limit';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useFlowcharts } from '@/hooks/use-flowcharts';
import { useGuestAIUsage } from '@/hooks/use-guest-ai-usage';
import {
  AlertCircle,
  Grid3X3,
  List,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from './empty-state';
import { FlowchartCard } from './flowchart-card';

type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc';
type ViewMode = 'grid' | 'list';

export function FlowchartsDashboard() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const {
    flowcharts,
    loading,
    error,
    refetch,
    deleteFlowchart,
    renameFlowchart,
  } = useFlowcharts();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showUsageLimitCard, setShowUsageLimitCard] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);

  const { usageData, checkUsageLimit, refreshUsageData } = useAIUsageLimit();
  const { canUseAI: canGuestUseAI } = useGuestAIUsage();

  // Filter and sort flowcharts
  const filteredAndSortedFlowcharts = useMemo(() => {
    const filtered = flowcharts.filter((flowchart) =>
      flowchart.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
        break;
      case 'name-asc':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'name-desc':
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return filtered;
  }, [flowcharts, searchQuery, sortBy]);

  const handleCreateNew = async () => {
    // Check AI usage limit based on user type
    if (currentUser) {
      // Logged in user - check subscription limits
      const canUseAI = await checkUsageLimit();
      if (!canUseAI) {
        setShowUsageLimitCard(true);
        return;
      }

      // Pre-create flowchart for logged in users
      try {
        const response = await fetch('/api/flowcharts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}), // Empty body for pre-creation
        });

        if (!response.ok) {
          throw new Error('Failed to create flowchart');
        }

        const data = await response.json();
        router.push(`/canvas/${data.id}`);
      } catch (error) {
        console.error('Error creating flowchart:', error);
        toast.error('Failed to create new flowchart');
      }
    } else {
      // Guest user - allow navigation to canvas without pre-creation
      // Backend will validate usage when AI is actually used
      console.log(
        '🎯 Guest user creating new flowchart - backend will validate AI usage when needed'
      );
      router.push('/canvas');
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteFlowchart(id);
    if (success) {
      toast.success('Flowchart deleted successfully');
    } else {
      toast.error('Failed to delete flowchart');
    }
  };

  const handleRename = async (id: string, newTitle: string) => {
    const success = await renameFlowchart(id, newTitle);
    if (success) {
      toast.success('Flowchart renamed successfully');
    } else {
      toast.error('Failed to rename flowchart');
    }
  };

  // Total count for controls visibility
  const totalFlowcharts = flowcharts.length;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-64">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-32 w-full mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load flowcharts: {error}</span>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-normal text-foreground mb-2">
            My Flowcharts
          </h1>
          <p className="text-muted-foreground font-normal">
            Create, edit, and manage your AI-powered flowcharts
          </p>
        </div>
        <Button onClick={handleCreateNew} className="font-normal">
          <Plus className="mr-2 h-4 w-4" />
          New Flowchart
        </Button>
      </div>

      {/* Guest Usage Indicator */}
      {!currentUser && <GuestUsageIndicator />}

      {/* Controls */}
      {totalFlowcharts > 0 && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search flowcharts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white font-normal"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </select>

            <div className="flex border border-gray-200 rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {filteredAndSortedFlowcharts.length === 0 ? (
        searchQuery ? (
          <div className="text-center py-16">
            <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No results found
            </h3>
            <p className="text-gray-600">
              Try adjusting your search query or create a new flowchart.
            </p>
          </div>
        ) : (
          <EmptyState onCreateNew={handleCreateNew} />
        )
      ) : (
        <div
          className={`grid gap-4 ${
            viewMode === 'grid'
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1'
          }`}
        >
          {filteredAndSortedFlowcharts.map((flowchart) => (
            <FlowchartCard
              key={flowchart.id}
              id={flowchart.id}
              title={flowchart.title}
              thumbnail={flowchart.thumbnail}
              createdAt={flowchart.createdAt}
              updatedAt={flowchart.updatedAt}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          ))}
        </div>
      )}

      {/* AI Usage Limit Card */}
      {showUsageLimitCard && usageData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUsageLimitCard(false)}
              className="absolute -top-2 -right-2 z-10 bg-white shadow-md hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
            </Button>
            <AIUsageLimitCard
              usedCount={usageData.usedCount}
              totalLimit={usageData.totalLimit}
              onUpgrade={() => {
                setShowUsageLimitCard(false);
                setShowPricingModal(true);
              }}
              onLearnMore={() => {
                setShowUsageLimitCard(false);
                setShowPricingModal(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => {
          setShowPricingModal(false);
          refreshUsageData(); // Refresh usage data when modal closes
        }}
      />
    </div>
  );
}
