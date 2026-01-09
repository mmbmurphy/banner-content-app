'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePipelineStore } from '@/lib/store/session-store';
import { jsPDF } from 'jspdf';
import { CollaborationPanel } from '@/components/collaboration';

export default function Step5PDF() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { loadSession, updateStepData, setCurrentStep } = usePipelineStore();
  const session = loadSession(sessionId);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep PDF in memory only (too large for localStorage)
  const pdfDataRef = useRef<string | null>(null);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [driveUrl, setDriveUrl] = useState<string | null>(session?.pdf.driveUrl || null);

  // Generate PDF from carousel images
  const handleGeneratePDF = async () => {
    if (!session?.carousel.imageUrls || session.carousel.imageUrls.length === 0) {
      setError('No carousel images available. Please complete Step 4 first.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [1080, 1080],
      });

      const images = session.carousel.imageUrls;

      for (let i = 0; i < images.length; i++) {
        if (i > 0) {
          doc.addPage([1080, 1080], 'portrait');
        }

        // Add image to PDF
        doc.addImage(images[i], 'PNG', 0, 0, 1080, 1080);
      }

      // Keep PDF data in memory (not localStorage - too large)
      pdfDataRef.current = doc.output('dataurlstring');
      setPdfGenerated(true);

      // Mark as generated (but don't store the actual PDF data)
      updateStepData(sessionId, 'pdf', {
        status: 'generated',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  // Upload PDF to Google Drive
  const handleUploadToDrive = async () => {
    if (!pdfDataRef.current) {
      setError('Please generate PDF first');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const res = await fetch('/api/google/drive-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfDataUrl: pdfDataRef.current,
          fileName: `${session?.topic.slug || 'carousel'}-carousel.pdf`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload to Drive');
      }

      setDriveUrl(data.driveUrl);

      // Store only the Drive URL (small string, fits in localStorage)
      updateStepData(sessionId, 'pdf', {
        status: 'uploaded',
        driveUrl: data.driveUrl,
      });

      // Also update export step
      updateStepData(sessionId, 'export', {
        driveUploaded: true,
        driveUrl: data.driveUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Download PDF
  const handleDownload = () => {
    if (!pdfDataRef.current) return;

    const link = document.createElement('a');
    link.href = pdfDataRef.current;
    link.download = `${session?.topic.slug || 'carousel'}-carousel.pdf`;
    link.click();
  };

  // Continue to next step
  const handleContinue = () => {
    setCurrentStep(sessionId, 6);
    router.push(`/pipeline/${sessionId}/step-6-export`);
  };

  // Go back
  const handleBack = () => {
    router.push(`/pipeline/${sessionId}/step-4-carousel`);
  };

  const hasCarouselImages = session?.carousel.imageUrls && session.carousel.imageUrls.length > 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brand-primary mb-2">
            Step 5: PDF Generation
          </h2>
          <p className="text-gray-500">
            Create a downloadable PDF from your carousel images
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-brand-primary mb-4">PDF Status</h3>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                hasCarouselImages ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
            <span className="text-sm">
              Carousel Images: {hasCarouselImages ? `${session?.carousel.imageUrls?.length} slides ready` : 'Not generated'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                pdfGenerated ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
            <span className="text-sm">
              PDF: {pdfGenerated ? 'Generated (in memory)' : 'Not generated'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                driveUrl ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
            <span className="text-sm">
              Google Drive: {driveUrl ? 'Uploaded' : 'Not uploaded'}
            </span>
          </div>
        </div>
      </div>

      {/* Carousel Preview */}
      {hasCarouselImages && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-brand-primary mb-4">
            Carousel Images Preview
          </h3>

          <div className="grid grid-cols-4 gap-2">
            {session?.carousel.imageUrls?.slice(0, 8).map((url, idx) => (
              <div key={idx} className="relative aspect-square">
                <img
                  src={url}
                  alt={`Slide ${idx + 1}`}
                  className="w-full h-full object-cover rounded border border-gray-200"
                />
                <span className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                  {idx + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={handleGeneratePDF}
          disabled={isGenerating || !hasCarouselImages}
          className="bg-brand-accent text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              Generating...
            </>
          ) : pdfGenerated ? (
            'Regenerate PDF'
          ) : (
            'Generate PDF'
          )}
        </button>

        {pdfGenerated && (
          <>
            <button
              onClick={handleDownload}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition"
            >
              Download PDF
            </button>

            <button
              onClick={handleUploadToDrive}
              disabled={isUploading || !!driveUrl}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Uploading...
                </>
              ) : driveUrl ? (
                'Uploaded to Drive'
              ) : (
                'Upload to Google Drive'
              )}
            </button>
          </>
        )}
      </div>

      {/* Drive Link */}
      {driveUrl && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-medium">PDF uploaded to Google Drive!</p>
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 hover:underline text-sm"
          >
            View in Google Drive →
          </a>
        </div>
      )}

      {/* PDF Preview */}
      {pdfGenerated && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-brand-primary mb-4">PDF Preview</h3>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-6xl mb-4">PDF</div>
            <p className="text-sm text-gray-600">
              {session?.topic.slug || 'carousel'}-carousel.pdf
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {session?.carousel.imageUrls?.length} pages
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={handleBack}
          className="text-gray-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition flex items-center gap-2"
        >
          <span>←</span>
          Back to Carousel
        </button>

        <button
          onClick={handleContinue}
          className="bg-brand-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition flex items-center gap-2"
        >
          Continue to Export
          <span>→</span>
        </button>
      </div>

      {/* Collaboration Panel */}
      <div className="mt-8">
        <CollaborationPanel
          sessionId={sessionId}
          sessionTitle={session?.topic.title || 'Untitled'}
          currentStep={5}
        />
      </div>
    </div>
  );
}
