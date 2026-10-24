import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

// Cross-field equality validator, e.g. `@IsMatch('password')` on confirmPassword.
// Replaces the zod `superRefine` password-match check.
export function IsMatch(property: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isMatch',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [relatedProperty] = args.constraints as [string];
          return value === (args.object as Record<string, unknown>)[relatedProperty];
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must match ${args.constraints[0]}`;
        },
      },
    });
  };
}
