import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Class-level validator that ensures `variablePrefix` and `variableSuffix`
 * are either both present or both absent on the decorated class.
 */
export function BothOrNeither(
  otherProperty: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'bothOrNeither',
      target: (object as { constructor: Function }).constructor,
      propertyName,
      constraints: [otherProperty],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [relatedProp] = args.constraints as [string];
          const related = (args.object as Record<string, unknown>)[relatedProp];
          const hasThis = value !== undefined && value !== null;
          const hasOther = related !== undefined && related !== null;
          // Both present or both absent
          return hasThis === hasOther;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} and ${args.constraints[0] as string} must both be provided or both be omitted`;
        },
      },
    });
  };
}
