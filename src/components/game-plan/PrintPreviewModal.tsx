'use client';

import { useRef, useState } from 'react';
import { X, Printer, Download, FileText, Watch } from 'lucide-react';
import PrintableGamePlan from './PrintableGamePlan';
import PrintableWristband from './PrintableWristband';
import type { GamePlanPlayWithDetails } from '@/types/football';
import type { GamePlanSide } from '@/lib/services/game-plan.service';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  opponent: string;
  gameDate: string;
  offensivePlaysBySituation: Record<string, GamePlanPlayWithDetails[]>;
  defensivePlaysBySituation: Record<string, GamePlanPlayWithDetails[]>;
  specialTeamsPlaysBySituation: Record<string, GamePlanPlayWithDetails[]>;
}

type PrintType = 'gameplan' | 'wristband';
type WristbandFormat = 'compact' | 'standard' | 'large';

export default function PrintPreviewModal({
  isOpen,
  onClose,
  teamName,
  opponent,
  gameDate,
  offensivePlaysBySituation,
  defensivePlaysBySituation,
  specialTeamsPlaysBySituation
}: PrintPreviewModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [printType, setPrintType] = useState<PrintType>('gameplan');
  const [selectedSide, setSelectedSide] = useState<GamePlanSide>('offense');
  const [wristbandFormat, setWristbandFormat] = useState<WristbandFormat>('standard');
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const getPlaysBySituation = (side: GamePlanSide) => {
    switch (side) {
      case 'offense': return offensivePlaysBySituation;
      case 'defense': return defensivePlaysBySituation;
      case 'special_teams': return specialTeamsPlaysBySituation;
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    const printContent = printRef.current;
    if (!printContent) {
      setIsPrinting(false);
      return;
    }

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print');
      setIsPrinting(false);
      return;
    }

    // Get the styles
    const styles = Array.from(document.styleSheets)
      .map(styleSheet => {
        try {
          return Array.from(styleSheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n');
        } catch {
          return '';
        }
      })
      .join('\n');

    // Write the print content
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${printType === 'gameplan' ? 'Game Plan' : 'QB Wristband'} - ${teamName} vs ${opponent}</title>
          <style>
            ${styles}
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            /* Tailwind reset and utilities */
            *, ::before, ::after { box-sizing: border-box; }
            .bg-white { background-color: white; }
            .bg-blue-600 { background-color: #2563eb; }
            .bg-blue-100 { background-color: #dbeafe; }
            .bg-amber-600 { background-color: #d97706; }
            .bg-amber-100 { background-color: #fef3c7; }
            .bg-purple-600 { background-color: #7c3aed; }
            .bg-purple-100 { background-color: #ede9fe; }
            .bg-gray-50 { background-color: #f9fafb; }
            .text-white { color: white; }
            .text-gray-900 { color: #111827; }
            .text-gray-600 { color: #4b5563; }
            .text-gray-500 { color: #6b7280; }
            .text-gray-400 { color: #9ca3af; }
            .text-blue-800 { color: #1e40af; }
            .text-amber-800 { color: #92400e; }
            .text-purple-800 { color: #5b21b6; }
            .font-bold { font-weight: 700; }
            .font-medium { font-weight: 500; }
            .text-xs { font-size: 0.75rem; }
            .text-sm { font-size: 0.875rem; }
            .text-lg { font-size: 1.125rem; }
            .text-xl { font-size: 1.25rem; }
            .text-2xl { font-size: 1.5rem; }
            .text-3xl { font-size: 1.875rem; }
            .rounded { border-radius: 0.25rem; }
            .rounded-lg { border-radius: 0.5rem; }
            .rounded-t { border-top-left-radius: 0.25rem; border-top-right-radius: 0.25rem; }
            .border { border-width: 1px; }
            .border-t { border-top-width: 1px; }
            .border-b { border-bottom-width: 1px; }
            .border-b-2 { border-bottom-width: 2px; }
            .border-b-4 { border-bottom-width: 4px; }
            .border-gray-200 { border-color: #e5e7eb; }
            .border-gray-300 { border-color: #d1d5db; }
            .border-dashed { border-style: dashed; }
            .flex { display: flex; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .items-center { align-items: center; }
            .items-start { align-items: start; }
            .justify-between { justify-content: space-between; }
            .justify-center { justify-content: center; }
            .gap-1 { gap: 0.25rem; }
            .gap-2 { gap: 0.5rem; }
            .gap-3 { gap: 0.75rem; }
            .gap-x-2 { column-gap: 0.5rem; }
            .gap-y-0\\.5 { row-gap: 0.125rem; }
            .space-y-1 > * + * { margin-top: 0.25rem; }
            .space-y-6 > * + * { margin-top: 1.5rem; }
            .p-2 { padding: 0.5rem; }
            .p-8 { padding: 2rem; }
            .px-1 { padding-left: 0.25rem; padding-right: 0.25rem; }
            .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
            .px-4 { padding-left: 1rem; padding-right: 1rem; }
            .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
            .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
            .pb-1 { padding-bottom: 0.25rem; }
            .pb-4 { padding-bottom: 1rem; }
            .pt-1 { padding-top: 0.25rem; }
            .pt-4 { padding-top: 1rem; }
            .mb-1 { margin-bottom: 0.25rem; }
            .mb-3 { margin-bottom: 0.75rem; }
            .mb-6 { margin-bottom: 1.5rem; }
            .mt-1 { margin-top: 0.25rem; }
            .mt-2 { margin-top: 0.5rem; }
            .mt-8 { margin-top: 2rem; }
            .mx-auto { margin-left: auto; margin-right: auto; }
            .w-4 { width: 1rem; }
            .w-5 { width: 1.25rem; }
            .w-6 { width: 1.5rem; }
            .w-10 { width: 2.5rem; }
            .h-4 { height: 1rem; }
            .h-5 { height: 1.25rem; }
            .h-6 { height: 1.5rem; }
            .h-10 { height: 2.5rem; }
            .min-w-0 { min-width: 0; }
            .flex-1 { flex: 1; }
            .flex-shrink-0 { flex-shrink: 0; }
            .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .italic { font-style: italic; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .max-w-\\[3\\.5in\\] { max-width: 3.5in; }
            .max-w-\\[4in\\] { max-width: 4in; }
            .max-w-\\[5in\\] { max-width: 5in; }
            .max-w-\\[8\\.5in\\] { max-width: 8.5in; }
            .text-\\[6pt\\] { font-size: 6pt; }
            .text-\\[7pt\\] { font-size: 7pt; }
            .text-\\[8pt\\] { font-size: 8pt; }
            .text-\\[9pt\\] { font-size: 9pt; }
            .text-\\[10pt\\] { font-size: 10pt; }
            .text-\\[11pt\\] { font-size: 11pt; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();

    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      setIsPrinting(false);
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Print Preview</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Options */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap gap-4">
            {/* Print Type */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Print Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPrintType('gameplan')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    printType === 'gameplan'
                      ? 'bg-gray-900 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Game Plan
                </button>
                <button
                  onClick={() => setPrintType('wristband')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    printType === 'wristband'
                      ? 'bg-gray-900 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Watch className="w-4 h-4" />
                  QB Wristband
                </button>
              </div>
            </div>

            {/* Side Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Side</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedSide('offense')}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedSide === 'offense'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Offense
                </button>
                <button
                  onClick={() => setSelectedSide('defense')}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedSide === 'defense'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Defense
                </button>
                <button
                  onClick={() => setSelectedSide('special_teams')}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedSide === 'special_teams'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Special Teams
                </button>
              </div>
            </div>

            {/* Wristband Size (only show for wristband type) */}
            {printType === 'wristband' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Wristband Size</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setWristbandFormat('compact')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      wristbandFormat === 'compact'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Compact
                  </button>
                  <button
                    onClick={() => setWristbandFormat('standard')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      wristbandFormat === 'standard'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    onClick={() => setWristbandFormat('large')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      wristbandFormat === 'large'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Large
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            <div ref={printRef}>
              {printType === 'gameplan' ? (
                <PrintableGamePlan
                  teamName={teamName}
                  opponent={opponent}
                  gameDate={gameDate}
                  side={selectedSide}
                  playsBySituation={getPlaysBySituation(selectedSide)}
                />
              ) : (
                <PrintableWristband
                  teamName={teamName}
                  opponent={opponent}
                  gameDate={gameDate}
                  side={selectedSide}
                  playsBySituation={getPlaysBySituation(selectedSide)}
                  format={wristbandFormat}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-between items-center">
          <p className="text-sm text-gray-500">
            Play numbers sync between Game Plan and QB Wristband
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              {isPrinting ? 'Printing...' : 'Print'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
