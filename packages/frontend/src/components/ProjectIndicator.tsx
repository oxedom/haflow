/**
 * ProjectIndicator Component
 * Compact display for header/toolbar showing project status at a glance
 * Shows a status indicator (dot) with project name
 */

import React, { useState } from 'react';
import { useLinkedProject } from '../hooks/useLinkedProject.js';

interface ProjectIndicatorProps {
  /** Optional click handler */
  onClick?: () => void;
  /** Optional className for customization */
  className?: string;
}

export function ProjectIndicator(props: ProjectIndicatorProps): React.ReactElement {
  const { data, isLoading } = useLinkedProject();
  const [showTooltip, setShowTooltip] = useState(false);

  // Determine status color
  let statusColor = 'bg-gray-400'; // default/loading
  let statusLabel = 'Loading';

  if (!isLoading) {
    if (data?.status === 'linked') {
      statusColor = 'bg-green-500';
      statusLabel = 'Linked';
    } else if (data?.status === 'missing') {
      statusColor = 'bg-yellow-500';
      statusLabel = 'Missing';
    } else if (data?.status === 'error') {
      statusColor = 'bg-red-500';
      statusLabel = 'Error';
    } else {
      statusColor = 'bg-gray-300';
      statusLabel = 'Not Linked';
    }
  }

  const projectName = data?.project?.name || 'No project';
  const projectPath = data?.project?.path || '';

  // Mobile-responsive: show full on desktop, icon-only on mobile
  return (
    <div
      className={`relative inline-flex items-center gap-2 ${props.className || ''}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Status indicator dot */}
      <div
        className={`h-2.5 w-2.5 rounded-full ${statusColor} transition-colors`}
        title={statusLabel}
      />

      {/* Project name - hidden on mobile, shown on desktop */}
      <button
        onClick={props.onClick}
        className="hidden items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 md:inline-flex"
        title={projectPath}
        style={{ maxWidth: '250px' }}
      >
        <span className="truncate">{projectName}</span>
        <span className="text-gray-400">→</span>
      </button>

      {/* Mobile icon-only version */}
      <button
        onClick={props.onClick}
        className="inline-flex items-center justify-center rounded p-1 hover:bg-gray-100 md:hidden"
        title={projectPath}
      >
        <svg
          className="h-4 w-4 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7l9-4 9 4"
          />
        </svg>
      </button>

      {/* Tooltip showing full path and status */}
      {showTooltip && projectPath && (
        <div className="pointer-events-none absolute left-0 top-full mt-2 z-50 w-max rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg">
          <div className="font-mono">{projectPath}</div>
          <div className="mt-0.5 text-gray-300">{statusLabel}</div>
          {data?.errorMessage && (
            <div className="mt-1 border-t border-gray-700 pt-1 text-red-300">
              {data.errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
