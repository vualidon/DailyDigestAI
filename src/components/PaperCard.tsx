import React, { useState, useEffect } from 'react';
import { Paper } from '../types';
import { CalendarIcon, ArrowUpIcon } from '@heroicons/react/24/outline';
import { PaperDetail } from './PaperDetail';
import axios from 'axios';
import { usePaperContext } from '../context/PaperContext';

interface PaperCardProps {
  paper: Paper;
}

export const PaperCard: React.FC<PaperCardProps> = ({ paper }) => {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { getPaperState, updatePaperState } = usePaperContext();
  const [isLoading, setIsLoading] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const preloadPdfContent = async () => {
    const paperState = getPaperState(paper.paper.id);
    if (paperState.pdfContent) return;

    setIsLoading(true);
    try {
      const response = await axios.post(
        'https://api.firecrawl.dev/v1/scrape',
        {
          url: `https://arxiv.org/pdf/${paper.paper.id}`,
          formats: ['markdown']
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_FIRECRAWL_API_KEY}`
          },
          timeout: 30000
        }
      );

      if (response.data.success) {
        updatePaperState(paper.paper.id, {
          pdfContent: response.data.data.markdown
        });
      }
    } catch (error) {
      console.error('Error preloading PDF content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isDetailOpen) {
      preloadPdfContent();
    }
  }, [isDetailOpen]);

  return (
    <>
      <div 
        className={`group bg-white dark:bg-gray-800/50 dark:backdrop-blur-sm rounded-2xl shadow-sm dark:shadow-[0_4px_20px_-2px_rgba(0,0,255,0.1)] border border-gray-100 dark:border-blue-500/20 hover:shadow-md dark:hover:shadow-[0_8px_30px_rgb(0,0,255,0.15)] hover:scale-[1.01] dark:hover:bg-gray-800/60 hover:border-blue-200 dark:hover:border-blue-400/30 transition-all duration-500 cursor-pointer ${
          isLoading ? 'animate-pulse' : ''
        }`}
        onClick={() => setIsDetailOpen(true)}
      >
        <div className="p-6">
          <div className="flex items-start gap-6">
            <img 
              src={paper.thumbnail} 
              alt={paper.title}
              className="w-32 h-32 object-cover rounded-xl bg-gray-50 dark:bg-gray-700/50 group-hover:shadow-lg dark:group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-500"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white dark:drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] group-hover:text-blue-600 dark:group-hover:text-blue-300 dark:group-hover:drop-shadow-[0_0_15px_rgba(59,130,246,0.4)] mb-3 line-clamp-2 transition-all duration-500">
                {paper.title}
              </h2>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-blue-200/80 mb-4 transition-colors duration-500">
                <div className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-300 transition-colors duration-300">
                  <CalendarIcon className="w-4 h-4" />
                  {formatDate(paper.publishedAt)}
                </div>
                <div className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-300 transition-colors duration-300">
                  <ArrowUpIcon className="w-4 h-4" />
                  {paper.paper.upvotes} upvotes
                </div>
              </div>

              <p className="text-gray-600 dark:text-gray-300/90 group-hover:text-gray-700 dark:group-hover:text-gray-200 line-clamp-3 mb-4 text-sm leading-relaxed transition-colors duration-500">
                {paper.paper.summary}
              </p>

              <div className="flex items-center gap-3">
                <img 
                  src={paper.submittedBy.avatarUrl} 
                  alt={paper.submittedBy.fullname}
                  className="w-6 h-6 rounded-full ring-2 ring-transparent dark:ring-blue-500/20 group-hover:ring-blue-500/50 dark:group-hover:ring-blue-400/50 transition-all duration-500"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-500">
                  Submitted by <span className="font-medium text-gray-900 dark:text-white dark:drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] group-hover:text-blue-600 dark:group-hover:text-blue-300">{paper.submittedBy.fullname}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PaperDetail
        paper={paper}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </>
  );
};