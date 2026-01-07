'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePipelineStore } from '@/lib/store/session-store';
import { StepperNav } from '@/components/pipeline/StepperNav';

export default function PipelineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { loadSession, setCurrentSessionId } = usePipelineStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = loadSession(sessionId);
    if (!session) {
      router.push('/');
      return;
    }
    setCurrentStep(session.currentStep);
    setCurrentSessionId(sessionId);
    setLoading(false);
  }, [sessionId, loadSession, setCurrentSessionId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
      </div>
    );
  }

  return (
    <div>
      <StepperNav sessionId={sessionId} currentStep={currentStep} />
      <div className="max-w-5xl mx-auto p-6">{children}</div>
    </div>
  );
}
