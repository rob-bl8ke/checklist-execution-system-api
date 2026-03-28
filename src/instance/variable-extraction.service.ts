import { Injectable } from '@nestjs/common';
import { TemplateStep } from '../template-step/template-step.entity';

@Injectable()
export class VariableExtractionService {
  /**
   * Scans each step's instructions for {{variableName}} placeholders,
   * deduplicates, and returns them sorted alphabetically.
   */
  extract(steps: TemplateStep[]): string[] {
    const names = new Set<string>();
    const regex = /{{(.*?)}}/g;

    for (const step of steps) {
      if (!step.instructions) continue;
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(step.instructions)) !== null) {
        names.add(match[1].trim());
      }
    }

    return [...names].sort();
  }
}
