import { VariableExtractionService } from './variable-extraction.service';
import { TemplateStep } from '../template-step/template-step.entity';

function makeStep(instructions: string | null): TemplateStep {
  return { instructions } as unknown as TemplateStep;
}

describe('VariableExtractionService', () => {
  const service = new VariableExtractionService();

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
