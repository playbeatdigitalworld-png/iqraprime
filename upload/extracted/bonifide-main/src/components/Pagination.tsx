import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate page numbers window
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#0e111c]/60 p-3.5 backdrop-blur-xl mt-4 text-xs text-slate-300">
      
      {/* Range and page size */}
      <div className="flex items-center gap-3">
        <div className="font-mono text-slate-400">
          Showing <span className="font-bold text-white">{startItem.toLocaleString()}</span> -{' '}
          <span className="font-bold text-white">{endItem.toLocaleString()}</span> of{' '}
          <span className="font-bold text-amber-400">{totalItems.toLocaleString()}</span> channels
        </div>

        <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
          <span className="text-[11px] text-slate-400">Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
          >
            <option value={24}>24</option>
            <option value={48}>48</option>
            <option value={96}>96</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </div>
      </div>

      {/* Page Navigation */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-white/5 bg-slate-900/60 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          title="First Page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        {/* Prev Page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-white/5 bg-slate-900/60 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          title="Previous Page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((num, idx) => (
          typeof num === 'number' ? (
            <button
              key={idx}
              onClick={() => onPageChange(num)}
              className={`min-w-8 h-8 rounded-lg font-mono font-bold transition-colors cursor-pointer ${
                currentPage === num
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'border border-white/5 bg-slate-900/60 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {num}
            </button>
          ) : (
            <span key={idx} className="px-1 text-slate-500">
              {num}
            </span>
          )
        ))}

        {/* Next Page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-white/5 bg-slate-900/60 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          title="Next Page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Last Page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-white/5 bg-slate-900/60 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          title="Last Page"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>

    </div>
  );
};
