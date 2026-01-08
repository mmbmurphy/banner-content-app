'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePipelineStore } from '@/lib/store/session-store';
import { CollaborationPanel } from '@/components/collaboration';

export default function Step6Export() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { loadSession, updateStepData, setCurrentStep } = usePipelineStore();
  const session = loadSession(sessionId);

  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetsExported, setSheetsExported] = useState(session?.export.sheetsExported || false);
  const [driveUploaded, setDriveUploaded] = useState(session?.export.driveUploaded || false);
  const [sheetUrl, setSheetUrl] = useState(session?.export.sheetUrl || '');
  const [driveUrl, setDriveUrl] = useState(session?.export.driveUrl || '');

  // Export to Google Sheets
  const handleExportSheets = async () => {
    setIsExportingSheets(true);
    setError(null);

    try {
      const res = await fetch('/api/google/sheets-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: session?.topic.slug,
          title: session?.topic.title,
          webflowUrl: session?.blog.publishedUrl,
          linkedinPosts: session?.linkedin.posts?.length || 0,
          carouselSlides: session?.carousel.imageUrls?.length || 0,
          pdfGenerated: !!session?.pdf.pdfUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to export to Sheets');
      }

      const data = await res.json();
      setSheetsExported(true);
      setSheetUrl(data.sheetUrl || '');

      updateStepData(sessionId, 'export', {
        sheetsExported: true,
        sheetUrl: data.sheetUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExportingSheets(false);
    }
  };

  // Upload PDF to Google Drive
  const handleUploadDrive = async () => {
    if (!session?.pdf.pdfUrl) {
      setError('No PDF available to upload');
      return;
    }

    setIsUploadingDrive(true);
    setError(null);

    try {
      const res = await fetch('/api/google/drive-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfDataUrl: session.pdf.pdfUrl,
          fileName: `${session.topic.slug}-carousel.pdf`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload to Drive');
      }

      const data = await res.json();
      setDriveUploaded(true);
      setDriveUrl(data.driveUrl || '');

      updateStepData(sessionId, 'export', {
        driveUploaded: true,
        driveUrl: data.driveUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploadingDrive(false);
    }
  };

  // Continue to next step
  const handleContinue = () => {
    setCurrentStep(sessionId, 7);
    router.push(`/pipeline/${sessionId}/step-7-queue`);
  };

  // Go back
  const handleBack = () => {
    router.push(`/pipeline/${sessionId}/step-5-pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brand-primary mb-2">
            Step 6: Export
          </h2>
          <p className="text-gray-500">
            Export content to Google Sheets and upload PDF to Drive
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Content Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-brand-primary mb-4">Content Summary</h3>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Topic:</span>
            <p className="font-medium">{session?.topic.title || 'N/A'}</p>
          </div>
          <div>
            <span className="text-gray-500">Slug:</span>
            <p className="font-medium">{session?.topic.slug || 'N/A'}</p>
          </div>
          <div>
            <span className="text-gray-500">Blog Status:</span>
            <p className="font-medium capitalize">{session?.blog.status || 'N/A'}</p>
          </div>
          <div>
            <span className="text-gray-500">LinkedIn Posts:</span>
            <p className="font-medium">{session?.linkedin.posts?.length || 0}</p>
          </div>
          <div>
            <span className="text-gray-500">Carousel Slides:</span>
            <p className="font-medium">{session?.carousel.imageUrls?.length || 0}</p>
          </div>
          <div>
            <span className="text-gray-500">PDF Status:</span>
            <p className="font-medium">{session?.pdf.pdfUrl ? 'Generated' : 'Not generated'}</p>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="space-y-4 mb-8">
        {/* Google Sheets Export */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-brand-primary">Google Sheets</h3>
              <p className="text-sm text-gray-500 mt-1">
                Add content record to tracking spreadsheet
              </p>
            </div>

            {sheetsExported ? (
              <div className="flex items-center gap-2">
                <span className="text-green-600 text-sm">Exported</span>
                <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  ✓
                </span>
              </div>
            ) : (
              <button
                onClick={handleExportSheets}
                disabled={isExportingSheets}
                className="bg-brand-accent text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExportingSheets ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Exporting...
                  </>
                ) : (
                  'Export to Sheets'
                )}
              </button>
            )}
          </div>

          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-accent hover:underline mt-3 block"
            >
              View in Google Sheets
            </a>
          )}
        </div>

        {/* Google Drive Upload */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-brand-primary">Google Drive</h3>
              <p className="text-sm text-gray-500 mt-1">
                Upload carousel PDF to Drive folder
              </p>
            </div>

            {driveUploaded ? (
              <div className="flex items-center gap-2">
                <span className="text-green-600 text-sm">Uploaded</span>
                <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  ✓
                </span>
              </div>
            ) : (
              <button
                onClick={handleUploadDrive}
                disabled={isUploadingDrive || !session?.pdf.pdfUrl}
                className="bg-brand-accent text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploadingDrive ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Uploading...
                  </>
                ) : (
                  'Upload to Drive'
                )}
              </button>
            )}
          </div>

          {driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-accent hover:underline mt-3 block"
            >
              View in Google Drive
            </a>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={handleBack}
          className="text-gray-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition flex items-center gap-2"
        >
          <span>←</span>
          Back to PDF
        </button>

        <button
          onClick={handleContinue}
          className="bg-brand-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition flex items-center gap-2"
        >
          Continue to Queue
          <span>→</span>
        </button>
      </div>

      {/* Collaboration Panel */}
      <div className="mt-8">
        <CollaborationPanel
          sessionId={sessionId}
          sessionTitle={session?.topic.title || 'Untitled'}
          currentStep={6}
        />
      </div>
    </div>
  );
}
