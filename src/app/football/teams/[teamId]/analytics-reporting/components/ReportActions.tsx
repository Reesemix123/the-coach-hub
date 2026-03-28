/**
 * ReportActions Component
 *
 * Action buttons for reports: Export PDF, Print, Share, etc.
 */

'use client';

import { Printer, Download, Share2 } from 'lucide-react';

interface ReportActionsProps {
  reportName: string;
  onExportPDF?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
}

export default function ReportActions({
  reportName,
  onExportPDF,
  onPrint,
  onShare,
}: ReportActionsProps) {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const handleExportPDF = () => {
    if (onExportPDF) {
      onExportPDF();
    } else {
      // TODO: Implement PDF export in Phase 7
      alert('PDF export coming soon!');
    }
  };

  const handleShare = () => {
    if (onShare) {
      onShare();
    } else {
      // Copy current URL to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex-1">
        <h1 className="text-2xl font-semibold text-gray-900">{reportName}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Print Button */}
        <button
          onClick={handlePrint}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          title="Print Report"
        >
          <Printer className="h-4 w-4" />
          <span className="hidden sm:inline">Print</span>
        </button>

        {/* Export PDF Button */}
        <button
          onClick={handleExportPDF}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          title="Export as PDF"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export PDF</span>
        </button>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          title="Share Report"
        >
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>
    </div>
  );
}
