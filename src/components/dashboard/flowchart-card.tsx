'use client';

import { MagicCard } from '@/components/magicui/magic-card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDistanceToNow } from 'date-fns';
import {
  Calendar,
  Clock,
  Edit,
  ExternalLink,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface FlowchartCardProps {
  id: string;
  title: string;
  thumbnail?: string | null;
  createdAt: Date;
  updatedAt: Date;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

export function FlowchartCard({
  id,
  title,
  thumbnail,
  createdAt,
  updatedAt,
  onDelete,
  onRename,
}: FlowchartCardProps) {
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = () => {
    router.push(`/canvas/${id}`);
  };

  const handleRename = () => {
    if (newTitle.trim() && newTitle !== title) {
      onRename(id, newTitle.trim());
    }
    setIsRenaming(false);
  };

  const handleDelete = () => {
    onDelete(id);
    setIsDeleting(false);
  };

  const isRecentlyUpdated =
    new Date().getTime() - updatedAt.getTime() < 24 * 60 * 60 * 1000;

  return (
    <MagicCard className="cursor-pointer hover:shadow-lg transition-all duration-300">
      <Card className="h-full border-0 shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3
                className="font-semibold text-lg truncate hover:text-primary transition-colors"
                onClick={handleEdit}
                title={title}
              >
                {title}
              </h3>
              {isRecentlyUpdated && (
                <Badge variant="secondary" className="mt-1 text-xs">
                  Recently Updated
                </Badge>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEdit}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsDeleting(true)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          <div
            className="h-32 rounded-lg border-2 border-dashed border-gray-200 overflow-hidden hover:border-primary/50 transition-colors cursor-pointer bg-white"
            onClick={handleEdit}
          >
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={`Preview of ${title}`}
                className="w-full h-full object-contain bg-white"
                style={{ imageRendering: 'crisp-edges' }}
              />
            ) : (
              <div className="h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-2xl mb-2">📊</div>
                  <div className="text-sm">Click to edit</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-0">
          <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                Created {formatDistanceToNow(createdAt, { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>
                Updated {formatDistanceToNow(updatedAt, { addSuffix: true })}
              </span>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* Rename Dialog */}
      <Dialog open={isRenaming} onOpenChange={setIsRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Flowchart</DialogTitle>
            <DialogDescription>
              Enter a new name for your flowchart.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter flowchart title"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenaming(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flowchart</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{title}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MagicCard>
  );
}
