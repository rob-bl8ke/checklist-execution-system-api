import { Injectable } from '@nestjs/common';
import { TemplateStep } from '../template-step/template-step.entity';
import { escapeRegex } from '../common/escape-regex';

@Injectable()
export class VariableExtractionService {
  /**
   * Scans each step's instructions for placeholder patterns, deduplicates,
   * and returns variable names sorted alphabetically.
   *
   * @param steps      Template steps to scan
   * @param prefix     Opening delimiter (default `{{`)
   * @param suffix     Closing delimiter (default `}}`)
   */
  extract(steps: TemplateStep[], prefix = '{{', suffix = '}}'): string[] {
    const names = new Set<string>();
    const regex = new RegExp(
      escapeRegex(prefix) + '(.*?)' + escapeRegex(suffix),
      'g',
    );

    for (const step of steps) {
      if (!step.instructions) continue;
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(step.instructions)) !== null) {
        // Strip pipe transforms — take only the base variable name
        const varName = match[1].split('|')[0].trim();
        if (varName) names.add(varName);
      }
    }

    return [...names].sort();
  }
}
