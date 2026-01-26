import { z } from 'zod';

// Common validation patterns
const phoneRegex = /^[\d\s+\-()]{0,15}$/;
const licenseNumberRegex = /^[A-Z0-9\s\-]{0,20}$/i;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sanitize string to prevent XSS
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

// Common field validators
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(255, 'Email must be less than 255 characters')
  .refine((val) => emailRegex.test(val), 'Invalid email format');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .refine(
    (val) => /[A-Z]/.test(val) && /[a-z]/.test(val) && /[0-9]/.test(val),
    'Password must contain uppercase, lowercase, and number'
  );

export const simplePasswordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password must be less than 128 characters');

export const phoneSchema = z
  .string()
  .max(15, 'Phone must be 15 characters or less')
  .refine((val) => !val || phoneRegex.test(val), 'Invalid phone format')
  .optional()
  .nullable();

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be less than 100 characters')
  .transform(sanitizeString);

export const addressSchema = z
  .string()
  .max(500, 'Address must be less than 500 characters')
  .transform(sanitizeString)
  .optional()
  .nullable();

export const descriptionSchema = z
  .string()
  .max(1000, 'Description must be less than 1000 characters')
  .transform(sanitizeString)
  .optional()
  .nullable();

export const amountSchema = z
  .number()
  .min(0, 'Amount must be positive')
  .max(100000000, 'Amount exceeds maximum limit');

export const quantitySchema = z
  .number()
  .int('Quantity must be a whole number')
  .min(0, 'Quantity must be positive')
  .max(1000000, 'Quantity exceeds maximum limit');

// Login form schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

// Signup form schema
export const signupSchema = z.object({
  email: emailSchema,
  password: simplePasswordSchema,
  fullName: nameSchema,
});

// Driver creation schema
export const createDriverSchema = z.object({
  email: emailSchema,
  password: simplePasswordSchema,
  full_name: nameSchema,
  phone: phoneSchema,
  license_number: z
    .string()
    .max(20, 'License number must be 20 characters or less')
    .refine((val) => !val || licenseNumberRegex.test(val), 'Invalid license format')
    .optional()
    .nullable(),
  license_expiry: z.string().optional().nullable(),
  address: addressSchema,
});

// Expense submission schema
export const expenseSchema = z.object({
  trip_id: z.string().uuid('Invalid trip'),
  category_id: z.string().uuid('Invalid category'),
  amount: amountSchema,
  expense_date: z.string().min(1, 'Date is required'),
  description: descriptionSchema,
  fuel_quantity: z
    .number()
    .min(0, 'Fuel quantity must be positive')
    .max(10000, 'Fuel quantity exceeds limit')
    .optional()
    .nullable(),
});

// Invoice customer schema
export const customerSchema = z.object({
  customer_name: nameSchema,
  customer_phone: phoneSchema,
  customer_address: addressSchema,
  customer_gst: z
    .string()
    .max(15, 'GST number must be 15 characters')
    .optional()
    .nullable(),
});

// Repair record schema
export const repairRecordSchema = z.object({
  bus_registration: z
    .string()
    .trim()
    .min(1, 'Bus registration is required')
    .max(20, 'Registration must be 20 characters or less'),
  repair_type: z.string().min(1, 'Repair type is required'),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(1000, 'Description must be less than 1000 characters')
    .transform(sanitizeString),
  parts_changed: descriptionSchema,
  parts_cost: amountSchema.optional(),
  labor_cost: amountSchema.optional(),
  warranty_days: z.number().int().min(0).max(365).optional(),
  notes: descriptionSchema,
});

// Profile update schema
export const profileUpdateSchema = z.object({
  full_name: nameSchema,
  phone: phoneSchema,
  license_number: z.string().max(20).optional().nullable(),
  license_expiry: z.string().optional().nullable(),
  address: addressSchema,
});

// Password change schema
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Validate and return errors or data
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    if (err.path.length > 0) {
      errors[err.path[0].toString()] = err.message;
    }
  });
  
  return { success: false, errors };
}

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type CreateDriverFormData = z.infer<typeof createDriverSchema>;
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;
