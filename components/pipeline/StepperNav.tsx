'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const STEPS = [
  { id: 1, name: 'Topic', path: 'step-1-topic' },
  { id: 2, name: 'Blog', path: 'step-2-blog' },
  { id: 3, name: 'LinkedIn', path: 'step-3-linkedin' },
  { id: 4, name: 'Carousel', path: 'step-4-carousel' },
  { id: 5, name: 'PDF', path: 'step-5-pdf' },
  { id: 6, name: 'Export', path: 'step-6-export' },
  { id: 7, name: 'Queue', path: 'step-7-queue' },
];

interface StepperNavProps {
  sessionId: string;
  currentStep: number;
}

export function StepperNav({ sessionId, currentStep }: StepperNavProps) {
  const pathname = usePathname();

  const getCurrentStepFromPath = () => {
    const match = pathname.match(/step-(\d+)/);
    return match ? parseInt(match[1]) : 1;
  };

  const activeStep = getCurrentStepFromPath();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-center gap-1">
        {STEPS.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = activeStep === step.id;
          const isAccessible = currentStep >= step.id;

          return (
            <div key={step.id} className="flex items-center">
              {index > 0 && (
                <div
                  className={`w-8 h-0.5 mx-1 ${
                    isCompleted ? 'bg-brand-green' : 'bg-gray-200'
                  }`}
                />
              )}
              {isAccessible ? (
                <Link
                  href={`/pipeline/${sessionId}/${step.path}`}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    isCurrent
                      ? 'bg-brand-accent text-white'
                      : isCompleted
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      isCurrent
                        ? 'bg-white text-brand-accent'
                        : isCompleted
                        ? 'bg-brand-green text-white'
                        : 'bg-gray-300 text-white'
                    }`}
                  >
                    {isCompleted ? '✓' : step.id}
                  </span>
                  <span className="hidden md:inline">{step.name}</span>
                </Link>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-400 cursor-not-allowed">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs bg-gray-200 text-gray-400">
                    {step.id}
                  </span>
                  <span className="hidden md:inline">{step.name}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
