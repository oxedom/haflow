/**
 * ProjectDisplay Component
 * Displays detailed information about the currently linked project
 * Shows all states: loading, linked, unlinked, error, missing
 */

import React from 'react';
import { useLinkedProject } from '../hooks/useLinkedProject.js';
import { Button } from './ui/button.js';
import { Card } from './ui/card.js';

export function ProjectDisplay(): React.ReactElement {
  const { data, isLoading, error, refetch } = useLinkedProject();

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-x-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
          <p className="text-sm text-gray-600">Loading project state...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 p-6">
        <div className="flex items-start space-x-3">
          <div className="mt-1 text-lg text-red-600">⚠️</div>
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error Reading Project State</h3>
            <p className="mt-1 text-sm text-red-700">{error.message}</p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="mt-3 border-red-600 text-red-600 hover:bg-red-100"
            >
              Try Again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!data || data.status === 'unlinked') {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="mb-3 text-3xl text-gray-400">📁</div>
          <h3 className="font-semibold text-gray-800">No Project Linked</h3>
          <p className="mt-2 text-sm text-gray-600">
            Link a project using the CLI to get started:
          </p>
          <code className="mt-3 inline-block rounded bg-gray-100 px-3 py-2 text-xs text-gray-800">
            haflow link /path/to/project
          </code>
        </div>
      </Card>
    );
  }

  if (data.status === 'missing') {
    return (
      <Card className="border-yellow-200 bg-yellow-50 p-6">
        <div className="flex items-start space-x-3">
          <div className="mt-1 text-lg text-yellow-600">⚠️</div>
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900">Project Not Found</h3>
            <p className="mt-1 text-sm text-yellow-700">
              The linked project directory no longer exists at:
            </p>
            <code className="mt-2 block break-all rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-900">
              {data.project?.path}
            </code>
            <p className="mt-2 text-sm text-yellow-700">
              You can relink the project using the CLI.
            </p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="mt-3 border-yellow-600 text-yellow-600 hover:bg-yellow-100"
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (data.status === 'error') {
    return (
      <Card className="border-red-200 bg-red-50 p-6">
        <div className="flex items-start space-x-3">
          <div className="mt-1 text-lg text-red-600">❌</div>
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Project Error</h3>
            <p className="mt-1 text-sm text-red-700">{data.errorMessage}</p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="mt-3 border-red-600 text-red-600 hover:bg-red-100"
            >
              Try Again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Linked state
  if (data.status === 'linked' && data.project) {
    const linkedDate = new Date(data.project.linkedAt);
    const linkedTimeString = linkedDate.toLocaleString();

    return (
      <Card className="border-green-200 bg-green-50 p-6">
        <div className="flex items-start space-x-4">
          <div className="mt-1 text-lg">✓</div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-gray-900">Project Linked</h3>
              <p className="mt-0.5 text-sm text-gray-600">
                This project is synchronized with the CLI
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-lg bg-white p-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Name
                </label>
                <p className="mt-1 text-sm font-mono text-gray-900">
                  {data.project.name}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Project ID
                </label>
                <p className="mt-1 text-sm font-mono text-gray-900">
                  {data.project.id}
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600">
                  Path
                </label>
                <p className="mt-1 break-all text-sm font-mono text-gray-900">
                  {data.project.path}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Linked At
                </label>
                <p className="mt-1 text-sm text-gray-900">{linkedTimeString}</p>
              </div>

              {data.project.workspaceId && (
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Workspace ID
                  </label>
                  <p className="mt-1 text-sm font-mono text-gray-900">
                    {data.project.workspaceId}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => refetch()}
                variant="outline"
                className="text-xs"
              >
                Refresh
              </Button>
              <Button
                variant="ghost"
                className="text-xs text-blue-600 hover:bg-blue-50"
                onClick={() => {
                  // Copy path to clipboard
                  navigator.clipboard.writeText(data.project!.path);
                }}
              >
                Copy Path
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return null;
}
