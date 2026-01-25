import type { ValidationError } from '@/types/workflow';
import { AlertTriangle } from 'lucide-react';

interface ValidationErrorsProps {
  errors: ValidationError[];
  onErrorClick?: (nodeId: string) => void;
}

export function ValidationErrors({ errors, onErrorClick }: ValidationErrorsProps) {
  if (errors.length === 0) return null;

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        <h4 className="font-semibold text-red-700">Validation Errors</h4>
      </div>
      <ul className="space-y-1">
        {errors.map((error, index) => (
          <li
            key={index}
            onClick={() => error.nodeId && onErrorClick?.(error.nodeId)}
            className={`text-sm text-red-600 ${
              error.nodeId
                ? 'cursor-pointer hover:text-red-800 hover:underline'
                : ''
            }`}
            data-testid={`validation-error-${index}`}
          >
            {error.field && (
              <span className="font-medium">{error.field}: </span>
            )}
            {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
