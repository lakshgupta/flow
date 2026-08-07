import { CircleAlert, TriangleAlert } from "lucide-react";
import { memo, useEffect, useState } from "react";

import { loadGraphValidation } from "../lib/api";
import type { EdgeTypeViolation, GraphValidationResponse } from "../types";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type GraphValidationIndicatorProps = {
  graphPath: string;
  /** Bump to re-validate after graph mutations (document/edge saves). */
  reloadToken: number;
  /** Opens the right-rail violations sidebar (e.g. to inspect the list in detail). */
  onOpen?: () => void;
};

function GraphValidationIndicatorComponent({ graphPath, reloadToken, onOpen }: GraphValidationIndicatorProps) {
  const [validation, setValidation] = useState<GraphValidationResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (graphPath.trim() === "") {
      setValidation(null);
      return;
    }

    loadGraphValidation(graphPath)
      .then((response) => {
        if (!cancelled) {
          setValidation(response);
        }
      })
      .catch(() => {
        // The indicator is informational; silently hide on fetch failures.
        if (!cancelled) {
          setValidation(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [graphPath, reloadToken]);

  const violations = validation?.violations ?? [];
  const errorCount = validation?.errorCount ?? 0;
  const warningCount = validation?.warningCount ?? 0;

  if (violations.length === 0) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`graph-validation-indicator${errorCount > 0 ? " graph-validation-indicator-error" : ""}`}
          aria-label={`${errorCount} edge-type errors, ${warningCount} warnings`}
          onClick={onOpen}
        >
          {errorCount > 0 ? <CircleAlert size={15} /> : <TriangleAlert size={15} />}
          <span className="graph-validation-indicator-count">
            {errorCount > 0 ? errorCount : warningCount}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="graph-validation-tooltip">
        <div className="graph-validation-tooltip-title">Graph edge validation</div>
        <ul className="graph-validation-tooltip-list">
          {violations.map((violation, index) => (
            <li key={`${violation.path}-${violation.fromID}-${violation.toID}-${violation.relationship}-${index}`}>
              <span className={`graph-validation-severity graph-validation-severity-${violation.severity}`}>
                {violation.severity}
              </span>
              <span>{violation.message}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

export const GraphValidationIndicator = memo(GraphValidationIndicatorComponent);
