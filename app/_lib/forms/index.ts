/**
 * RevLine Forms
 * 
 * Form field components and utilities for building custom forms.
 * Import from '@/app/_lib/forms'.
 * 
 * @example
 * import { TextField, EmailField, useFormState } from '@/app/_lib/forms';
 * 
 * function MyForm() {
 *   const form = useFormState({ email: '', name: '' });
 *   
 *   return (
 *     <form>
 *       <EmailField name="email" label="Email" {...form.getFieldProps('email')} />
 *       <TextField name="name" label="Name" {...form.getFieldProps('name')} />
 *     </form>
 *   );
 * }
 */

// Components
export {
  TextField,
  EmailField,
  PhoneField,
  TextareaField,
  SelectField,
  CheckboxField,
  DateField,
} from './components';

// Types
export type {
  BaseFieldProps,
  TextFieldProps,
  TextareaFieldProps,
  SelectFieldProps,
  CheckboxFieldProps,
  DateFieldProps,
  FieldOption,
  FormState,
  FormStatus,
  FormSubmitHandler,
} from './types';

// Hooks and utilities
export { 
  useFormState,
  validateEmail,
  validatePhone,
  validateRequired,
} from './useFormState';
