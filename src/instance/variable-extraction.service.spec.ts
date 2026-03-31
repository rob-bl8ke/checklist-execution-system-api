import { VariableExtractionService } from './variable-extraction.service';
import { TemplateStep } from '../template-step/template-step.entity';

function makeStep(instructions: string | null): TemplateStep {
  return { instructions } as unknown as TemplateStep;
}

describe('VariableExtractionService', () => {
  const service = new VariableExtractionService();

  describe('default delimiters ({{ }})', () => {
    it('extracts a single variable', () => {
      const steps = [makeStep('docker build -t {{serviceName}} .')];
      expect(service.extract(steps)).toEqual(['serviceName']);
    });

    it('extracts multiple variables from one step', () => {
      const steps = [makeStep('{{image}}:{{version}}')];
      expect(service.extract(steps)).toEqual(['image', 'version']);
    });

    it('deduplicates across steps', () => {
      const steps = [
        makeStep('docker build -t {{serviceName}}:{{version}} .'),
        makeStep('kubectl apply -f {{serviceName}}-deploy.yaml'),
      ];
      expect(service.extract(steps)).toEqual(['serviceName', 'version']);
    });

    it('sorts results alphabetically', () => {
      const steps = [makeStep('{{zoo}} {{alpha}} {{middle}}')];
      expect(service.extract(steps)).toEqual(['alpha', 'middle', 'zoo']);
    });

    it('returns empty array when no placeholders are present', () => {
      const steps = [makeStep('No variables here'), makeStep(null)];
      expect(service.extract(steps)).toEqual([]);
    });

    it('returns empty array for empty steps array', () => {
      expect(service.extract([])).toEqual([]);
    });

    it('skips steps with null instructions', () => {
      const steps = [makeStep(null), makeStep('{{foo}}')];
      expect(service.extract(steps)).toEqual(['foo']);
    });

    it('trims whitespace inside braces', () => {
      const steps = [makeStep('{{ trimmed }}')];
      expect(service.extract(steps)).toEqual(['trimmed']);
    });
  });

  describe('custom delimiters', () => {
    it('extracts variables with @{ } delimiters', () => {
      const steps = [makeStep('Deploy @{serviceName} to @{env}')];
      expect(service.extract(steps, '@{', '}')).toEqual(['env', 'serviceName']);
    });

    it('extracts variables with <% %> delimiters', () => {
      const steps = [makeStep('Hello <%name%> from <%region%>')];
      expect(service.extract(steps, '<%', '%>')).toEqual(['name', 'region']);
    });

    it('extracts variables with ${ } delimiters (regex-special $)', () => {
      const steps = [makeStep('kubectl apply -f ${service}-deploy.yaml')];
      expect(service.extract(steps, '${', '}')).toEqual(['service']);
    });

    it('does NOT extract default {{ }} when custom delimiters are set', () => {
      const steps = [makeStep('{{helmValue}} and @{myVar}')];
      // Only @{ } should match
      expect(service.extract(steps, '@{', '}')).toEqual(['myVar']);
    });

    it('deduplicates across steps with custom delimiters', () => {
      const steps = [
        makeStep('@{service} is running'),
        makeStep('Stop @{service}'),
      ];
      expect(service.extract(steps, '@{', '}')).toEqual(['service']);
    });
  });

  describe('pipe expression stripping', () => {
    it('strips single pipe and returns base variable name', () => {
      const steps = [makeStep('{{title | upper}}')];
      expect(service.extract(steps)).toEqual(['title']);
    });

    it('strips chained pipes and returns base variable name', () => {
      const steps = [makeStep('{{title | remove_spaces | lower}}')];
      expect(service.extract(steps)).toEqual(['title']);
    });

    it('strips parameterized pipe and returns base variable name', () => {
      const steps = [makeStep('{{version | replace(".", "_")}}')];
      expect(service.extract(steps)).toEqual(['version']);
    });

    it('deduplicates same variable used with and without pipes', () => {
      const steps = [makeStep('{{service}} deploys {{service | upper}}')];
      expect(service.extract(steps)).toEqual(['service']);
    });

    it('works with pipes and custom delimiters', () => {
      const steps = [makeStep('@{service | lower} is @{env | upper}')];
      expect(service.extract(steps, '@{', '}')).toEqual(['env', 'service']);
    });
  });
});
