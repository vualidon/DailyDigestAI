import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { fetchPapers } from '../api';
import { PaperCard } from './PaperCard';
import { Paper } from '../types';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

type SortOption = 'date' | 'upvotes';

export const PaperList: React.FC = () => {
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [searchTerm, setSearchTerm] = useState('');

  const {
    data: papers,
    isLoading,
    isError,
    error
  } = useQuery('papers', () => fetchPapers());

  const sortPapers = (papers: Paper[]) => {
    switch (sortBy) {
      case 'date':
        return [...papers].sort((a, b) => 
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
      case 'upvotes':
        return [...papers].sort((a, b) => b.paper.upvotes - a.paper.upvotes);
      default:
        return papers;
    }
  };

  const filterPapers = (papers: Paper[]) => {
    if (!searchTerm) return papers;
    return papers.filter(paper => 
      paper.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paper.paper.summary.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gray-600 dark:text-blue-200/80">Loading papers...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-600 dark:text-red-400">Error loading papers: {(error as Error).message}</div>
      </div>
    );
  }

  const allPapers = papers ?? [];
  const filteredAndSortedPapers = filterPapers(sortPapers(allPapers));

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-blue-300/50" />
          <input
            type="text"
            placeholder="Search papers..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-blue-500/20 rounded-xl bg-white dark:bg-gray-800/50 dark:backdrop-blur-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent hover:border-blue-200 dark:hover:border-blue-400/30 hover:shadow-lg dark:hover:shadow-[0_4px_20px_-2px_rgba(0,0,255,0.15)] transition-all duration-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-4 py-3 border border-gray-200 dark:border-blue-500/20 rounded-xl bg-white dark:bg-gray-800/50 dark:backdrop-blur-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent hover:border-blue-200 dark:hover:border-blue-400/30 hover:shadow-lg dark:hover:shadow-[0_4px_20px_-2px_rgba(0,0,255,0.15)] transition-all duration-500 cursor-pointer"
        >
          <option value="date">Sort by Date</option>
          <option value="upvotes">Sort by Upvotes</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredAndSortedPapers.map((paper) => (
          <PaperCard key={paper.paper.id} paper={paper} />
        ))}
      </div>
    </div>
  );
};