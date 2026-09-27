import React from 'react';
import { ThinkingStep } from '../types';

interface ThinkingStepsProps {
  steps?: ThinkingStep[];
  isStreaming?: boolean;
  hasContent?: boolean;
}

export const ThinkingSteps: React.FC<ThinkingStepsProps> = ({
  steps = [],
  isStreaming = false,
  hasContent = false,
}) => {
  if (!steps || steps.length === 0) return null;

  const renderIcon = (type: ThinkingStep['icon'], status: ThinkingStep['status']) => {
    switch (type) {
      case 'github':
        return (
          <div className="w-5 h-5 shrink-0 flex items-center justify-center text-neutral-800 dark:text-neutral-200">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </div>
        );

      case 'lightning':
        return (
          <div className="w-5 h-5 shrink-0 rounded-full bg-[#f97316] flex items-center justify-center shadow-xs">
            <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
        );

      case 'search':
        return (
          <div className="w-5 h-5 shrink-0 rounded-full bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 flex items-center justify-center text-orange-600 dark:text-orange-400">
            <svg className="w-3 h-3 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
        );

      case 'code':
        return (
          <div className="w-5 h-5 shrink-0 flex items-center justify-center text-neutral-800 dark:text-neutral-200">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </div>
        );

      case 'brain':
        return (
          <div className="w-5 h-5 shrink-0 rounded-full bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <svg className="w-3 h-3 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-4 4v1a4 4 0 0 0 4 4v1a4 4 0 0 0 4 4 4 4 0 0 0 4-4v-1a4 4 0 0 0 4-4v-1a4 4 0 0 0-4-4V6a4 4 0 0 0-4-4z" />
            </svg>
          </div>
        );

      default:
        return (
          <div className="w-5 h-5 shrink-0 flex items-center justify-center text-neutral-800 dark:text-neutral-200">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className={`space-y-2 py-1 select-none animate-in fade-in duration-300 ${hasContent ? 'mb-3.5 pb-2.5 border-b border-neutral-100 dark:border-neutral-800/80' : 'my-1.5'}`}>
      {steps.map((step, idx) => {
        const isRunning = step.status === 'running';
        return (
          <div
            key={step.id || idx}
            className="flex items-center gap-2.5 transition-all duration-300 text-[14px] leading-relaxed"
          >
            {renderIcon(step.icon || 'github', step.status)}
            <span
              className={`font-normal transition-colors duration-200 ${
                isRunning
                  ? 'text-neutral-900 dark:text-neutral-100 font-medium'
                  : 'text-neutral-700 dark:text-neutral-300'
              }`}
            >
              {step.title}
            </span>
            {isRunning && isStreaming && (
              <span className="flex items-center gap-1 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-pulse" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
